import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail, appUrl } from "@/lib/email";
import { renderDigest, digestSubject, type DigestEpisode } from "@/lib/digest-email";
import type { Quote } from "@/lib/types";

/** The digest goes out at the start of the day in Sydney. */
const TIME_ZONE = "Australia/Sydney";
/** Most episodes in one email. Busy weeks link to the app for the rest. */
const MAX_EPISODES = 10;
/** Never include episodes published longer ago than this, even if summarised late. */
const MAX_EPISODE_AGE_DAYS = 14;
/** Who the email is from (Spam Act: identify the sender and how to contact them). */
function senderLine() {
  const contact = process.env.CONTACT_EMAIL || process.env.ADMIN_EMAIL || "";
  return `Podcast Digest is run by Flynn Farquharson, Sydney, Australia.${contact ? ` Contact: ${contact}` : ""}`;
}

type Db = ReturnType<typeof createAdminClient>;
type Subscription = {
  user_id: string;
  frequency: "weekly" | "daily" | "off";
  unsubscribe_token: string;
  consented_at: string;
  last_sent_at: string | null;
};
export type DigestResult = { userId: string; status: "sent" | "nothing-new" | "not-due" | "failed"; episodes?: number; error?: string };

function sydneyWeekday(date = new Date()): string {
  return new Intl.DateTimeFormat("en-AU", { weekday: "long", timeZone: TIME_ZONE }).format(date);
}

/** Weekly goes out on Sundays; daily every day. The gaps stop double sends if the job runs twice. */
export function isDue(sub: Subscription, now = new Date()): boolean {
  if (sub.frequency === "off") return false;
  const last = sub.last_sent_at ? new Date(sub.last_sent_at).getTime() : 0;
  const hoursSince = (now.getTime() - last) / 3_600_000;
  if (sub.frequency === "daily") return hoursSince >= 20;
  return sydneyWeekday(now) === "Sunday" && hoursSince >= 5 * 24;
}

/** Episodes summarised since this person's last digest, from shows they follow. */
async function episodesFor(db: Db, sub: Subscription): Promise<DigestEpisode[]> {
  const { data: follows } = await db.from("user_follows").select("podcast_id").eq("user_id", sub.user_id);
  const { data: optouts } = await db.from("creator_optouts").select("podcast_id");
  const blocked = new Set((optouts ?? []).map((o) => o.podcast_id));
  const podcastIds = (follows ?? []).map((f) => f.podcast_id).filter((id) => !blocked.has(id));
  if (!podcastIds.length) return [];

  // First digest: include the past week so it isn't empty.
  const since = sub.last_sent_at ?? new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
  const publishedAfter = new Date(Date.now() - MAX_EPISODE_AGE_DAYS * 24 * 3600 * 1000).toISOString();
  const { data: episodes } = await db
    .from("episodes")
    .select("id, title, episode_url, podcasts(title, image_url), summaries(overview, quotes_with_timestamps), tips(tip_text, timestamp_seconds)")
    .in("podcast_id", podcastIds)
    .eq("status", "done")
    .gt("processed_at", since)
    .gt("published_at", publishedAfter)
    .order("published_at", { ascending: false })
    .limit(MAX_EPISODES);

  // Belt and braces: skip anything already sent to this person.
  const { data: recent } = await db.from("digest_sends").select("episode_ids").eq("user_id", sub.user_id).order("sent_at", { ascending: false }).limit(10);
  const alreadySent = new Set((recent ?? []).flatMap((r) => r.episode_ids as string[]));

  return (episodes ?? [])
    .filter((e) => !alreadySent.has(e.id))
    .map((e) => {
      const podcast = e.podcasts as unknown as { title: string; image_url: string | null } | null;
      const summaryRaw = e.summaries as unknown as { overview: string; quotes_with_timestamps: Quote[] } | { overview: string; quotes_with_timestamps: Quote[] }[] | null;
      const summary = Array.isArray(summaryRaw) ? summaryRaw[0] : summaryRaw;
      const tips = (e.tips as unknown as { tip_text: string; timestamp_seconds: number | null }[]) ?? [];
      return {
        id: e.id,
        title: e.title,
        podcastTitle: podcast?.title ?? "",
        imageUrl: podcast?.image_url ?? null,
        episodeUrl: e.episode_url,
        overview: summary?.overview ?? "",
        // One short quote per episode keeps us well inside "fair dealing".
        quote: summary?.quotes_with_timestamps?.find((q) => q.quote.length <= 220) ?? null,
        tips: tips.map((t) => ({ text: t.tip_text, timestampSeconds: t.timestamp_seconds })),
      };
    })
    .filter((e) => e.overview)
    .map(dropRepeatedQuote());
}

/** Some shows re-run segments (e.g. a "best of" edition), so never repeat a quote within one email. */
function dropRepeatedQuote() {
  const used = new Set<string>();
  return (e: DigestEpisode): DigestEpisode => {
    const key = e.quote?.quote.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (!key) return e;
    if (used.has(key)) return { ...e, quote: null };
    used.add(key);
    return e;
  };
}

/** Build and send one person's digest. `force` sends now (for previews) and doesn't mark episodes as sent. */
export async function sendDigestTo(db: Db, sub: Subscription, { force = false } = {}): Promise<DigestResult> {
  if (!force && !isDue(sub)) return { userId: sub.user_id, status: "not-due" };

  const episodes = await episodesFor(db, force ? { ...sub, last_sent_at: null } : sub);
  if (!episodes.length) return { userId: sub.user_id, status: "nothing-new" };

  const { data: userData, error: userError } = await db.auth.admin.getUserById(sub.user_id);
  const email = userData?.user?.email;
  if (userError || !email) return { userId: sub.user_id, status: "failed", error: "No email address" };

  const base = appUrl();
  const unsubscribe = `${base}/unsubscribe?token=${sub.unsubscribe_token}`;
  const frequency = sub.frequency === "daily" ? "daily" : "weekly";
  const { html, text } = renderDigest({
    episodes,
    frequency,
    senderLine: senderLine(),
    links: { app: base, settings: `${base}/settings`, unsubscribe, creators: `${base}/creators`, privacy: `${base}/privacy` },
  });

  try {
    const { id } = await sendEmail({
      to: email,
      subject: (force ? "[Preview] " : "") + digestSubject(episodes),
      html,
      text,
      // One-click unsubscribe, required by Gmail and Yahoo for bulk senders.
      headers: {
        "List-Unsubscribe": `<${base}/api/unsubscribe?token=${sub.unsubscribe_token}>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
    });
    if (!force) {
      await db.from("digest_sends").insert({ user_id: sub.user_id, episode_ids: episodes.map((e) => e.id), provider_id: id });
      await db.from("newsletter_subscriptions").update({ last_sent_at: new Date().toISOString() }).eq("user_id", sub.user_id);
    }
    return { userId: sub.user_id, status: "sent", episodes: episodes.length };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[digest] ${sub.user_id}: ${message}`);
    if (!force) await db.from("digest_sends").insert({ user_id: sub.user_id, error: message });
    return { userId: sub.user_id, status: "failed", error: message };
  }
}

const SUBSCRIPTION_COLUMNS = "user_id, frequency, unsubscribe_token, consented_at, last_sent_at";

/** Send every digest that's due now. Safe to run more than once a day. */
export async function sendDueDigests(): Promise<DigestResult[]> {
  const db = createAdminClient();
  const { data, error } = await db.from("newsletter_subscriptions").select(SUBSCRIPTION_COLUMNS).neq("frequency", "off");
  if (error) throw new Error(error.message);
  const results: DigestResult[] = [];
  for (const sub of (data ?? []) as Subscription[]) {
    results.push(await sendDigestTo(db, sub));
  }
  return results;
}

/** Send a preview of someone's digest to them right now. */
export async function sendPreviewTo(userId: string): Promise<DigestResult> {
  const db = createAdminClient();
  const { data } = await db.from("newsletter_subscriptions").select(SUBSCRIPTION_COLUMNS).eq("user_id", userId).maybeSingle();
  const sub = (data as Subscription | null) ?? {
    user_id: userId,
    frequency: "weekly" as const,
    unsubscribe_token: "preview",
    consented_at: new Date().toISOString(),
    last_sent_at: null,
  };
  return sendDigestTo(db, sub, { force: true });
}

/** Make sure someone has a subscription row (everyone who signs up gets the weekly digest). */
export async function ensureSubscription(userId: string, source = "signup") {
  const db = createAdminClient();
  await db
    .from("newsletter_subscriptions")
    .upsert({ user_id: userId, consent_source: source }, { onConflict: "user_id", ignoreDuplicates: true });
}
