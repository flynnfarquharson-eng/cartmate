import Link from "next/link";
import { notFound } from "next/navigation";
import { getUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminEmail } from "@/lib/env";
import { RecommendationStats } from "@/components/RecommendationStats";
import { timeAgo } from "@/lib/format";

export const metadata = { title: "Admin · Podcast Digest" };

// Rough per-unit costs (USD) for the cost estimate below.
const CLAUDE_PER_EPISODE = 0.15;
const DEEPGRAM_PER_MINUTE = 0.0043;
const DAILY_CAP = Number(process.env.MAX_EPISODES_PER_DAY) || 30;

function Stat({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-3">
      <p className="text-xs text-muted">{label}</p>
      <p className="text-2xl font-semibold tabular-nums">{value}</p>
      {sub && <p className="text-xs text-muted">{sub}</p>}
    </div>
  );
}

/** Time cut-offs for the stats, worked out once per request. */
function timeWindows() {
  const now = new Date();
  return {
    weekAgo: new Date(now.getTime() - 7 * 864e5).toISOString(),
    dayAgo: new Date(now.getTime() - 864e5).toISOString(),
    monthStart: new Date(now.getFullYear(), now.getMonth(), 1).toISOString(),
  };
}

function pct(n: number, d: number) {
  return d ? `${Math.round((n / d) * 100)}%` : "–";
}

/** The test dashboard: sign-ups by source, activation, the fake-door tests, digests and costs. */
export default async function AdminPage() {
  const user = await getUser();
  if (!isAdminEmail(user?.email)) notFound();

  const db = createAdminClient();
  const { weekAgo, dayAgo, monthStart } = timeWindows();

  const [usersRes, sources, follows, subs, sends, pushes, episodes, events, monthDone] = await Promise.all([
    db.auth.admin.listUsers({ perPage: 1000 }),
    db.from("signup_sources").select("user_id, ref, utm_source"),
    db.from("user_follows").select("user_id"),
    db.from("newsletter_subscriptions").select("frequency"),
    db.from("digest_sends").select("sent_at, error").gte("sent_at", weekAgo),
    db.from("push_subscriptions").select("user_id"),
    db.from("episodes").select("id, title, status, error, processing_started_at, processed_at, podcasts(title)").order("published_at", { ascending: false }).limit(300),
    db.from("product_events").select("event, user_id, anon_id, props"),
    db.from("episodes").select("id, duration_seconds, transcript_source").gte("processed_at", monthStart).eq("status", "done"),
  ]);

  const users = usersRes.data?.users ?? [];
  const newThisWeek = users.filter((u) => u.created_at >= weekAgo).length;

  // Sign-ups by source
  const sourceOf = new Map((sources.data ?? []).map((s) => [s.user_id, s.ref || s.utm_source || "direct"]));
  const bySource = new Map<string, number>();
  for (const u of users) {
    const s = sourceOf.get(u.id) ?? "direct / before tracking";
    bySource.set(s, (bySource.get(s) ?? 0) + 1);
  }

  // Activation: followed 3+ shows
  const followCounts = new Map<string, number>();
  for (const f of follows.data ?? []) followCounts.set(f.user_id, (followCounts.get(f.user_id) ?? 0) + 1);
  const activated = [...followCounts.values()].filter((n) => n >= 3).length;

  // Fake-door tests (count unique people, logged in or anonymous)
  const uniq = (event: string, filter?: (p: Record<string, unknown>) => boolean) =>
    new Set(
      (events.data ?? [])
        .filter((e) => e.event === event && (!filter || filter(e.props as Record<string, unknown>)))
        .map((e) => e.user_id ?? e.anon_id),
    ).size;
  const offerViews = uniq("founding_offer_view");
  const offerClicks = uniq("founding_offer_click");
  const appClicks = uniq("app_store_click");

  // Episodes and cost
  const eps = episodes.data ?? [];
  const status = (s: string) => eps.filter((e) => e.status === s).length;
  const startedToday = eps.filter((e) => e.processing_started_at && e.processing_started_at >= dayAgo).length;
  const done = monthDone.data ?? [];
  const deepgramMinutes = done.filter((e) => e.transcript_source === "deepgram").reduce((m, e) => m + (e.duration_seconds ?? 0) / 60, 0);
  const costClaude = done.length * CLAUDE_PER_EPISODE;
  const costDeepgram = deepgramMinutes * DEEPGRAM_PER_MINUTE;
  const failed = eps.filter((e) => e.status === "failed").slice(0, 5);
  const recentDone = eps.filter((e) => e.status === "done").slice(0, 8);

  const freq = (f: string) => (subs.data ?? []).filter((s) => s.frequency === f).length;
  const pushUsers = new Set((pushes.data ?? []).map((p) => p.user_id)).size;
  const sendsOk = (sends.data ?? []).filter((s) => !s.error).length;
  const sendsFailed = (sends.data ?? []).filter((s) => s.error).length;

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold tracking-tight">Admin</h1>

      <section>
        <h2 className="mb-3 text-lg font-semibold">People</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="Users" value={users.length} sub={`+${newThisWeek} this week`} />
          <Stat label="Followed 3+ shows" value={activated} sub={`${pct(activated, users.length)} of users`} />
          <Stat label="Digest subscribers" value={freq("weekly") + freq("daily")} sub={`${freq("weekly")} weekly · ${freq("daily")} daily · ${freq("off")} off`} />
          <Stat label="Push notifications" value={pushUsers} sub="people with it on" />
        </div>
        <h3 className="mb-2 mt-4 text-sm font-semibold">Sign-ups by source</h3>
        <ul className="divide-y divide-border rounded-2xl border border-border bg-surface text-sm">
          {[...bySource.entries()].sort((a, b) => b[1] - a[1]).map(([s, n]) => (
            <li key={s} className="flex justify-between px-3 py-2">
              <span>{s}</span>
              <span className="tabular-nums">{n}</span>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-muted">
          Tag links like <code>podcast-digest-six.vercel.app/?ref=instagram</code> to see where people come from.
        </p>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Tests</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Stat label="Founding offer: saw it" value={offerViews} />
          <Stat label="Founding offer: tapped join" value={offerClicks} sub={`${pct(offerClicks, offerViews)} of viewers`} />
          <Stat label="App Store button taps" value={appClicks} sub="on the landing page" />
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Episodes and costs</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="Summarised" value={status("done")} sub={`${status("pending")} waiting · ${status("failed")} failed`} />
          <Stat label="Started in last 24h" value={`${startedToday}/${DAILY_CAP}`} sub="daily cap" />
          <Stat label="Est. cost this month" value={`US$${(costClaude + costDeepgram).toFixed(2)}`} sub={`Claude ~$${costClaude.toFixed(2)} · Deepgram ~$${costDeepgram.toFixed(2)} (free credit)`} />
          <Stat label="Digests sent (7 days)" value={sendsOk} sub={sendsFailed ? `${sendsFailed} failed` : "none failed"} />
        </div>
        {failed.length > 0 && (
          <>
            <h3 className="mb-2 mt-4 text-sm font-semibold">Recent failures</h3>
            <ul className="space-y-1 text-sm">
              {failed.map((e) => (
                <li key={e.id} className="rounded-xl border border-border bg-surface px-3 py-2">
                  <span className="font-medium">{(e.podcasts as unknown as { title: string } | null)?.title}</span>: {e.title}
                  <p className="text-xs text-red-600">{e.error}</p>
                </li>
              ))}
            </ul>
          </>
        )}
        <p className="mt-2 text-xs text-muted">Estimates use ~US$0.15 per summary and Deepgram&apos;s list price. Your Anthropic console has exact figures.</p>
      </section>

      <section>
        <h2 className="mb-1 text-lg font-semibold">Instagram carousels</h2>
        <p className="mb-3 text-sm text-muted">Ready-to-post slides from recent summaries.</p>
        <ul className="divide-y divide-border rounded-2xl border border-border bg-surface text-sm">
          {recentDone.map((e) => (
            <li key={e.id}>
              <Link href={`/admin/carousel/${e.id}`} className="flex justify-between gap-3 px-3 py-2 hover:text-accent">
                <span className="min-w-0 truncate">
                  <span className="text-muted">{(e.podcasts as unknown as { title: string } | null)?.title} · </span>
                  {e.title}
                </span>
                <span className="shrink-0 text-xs text-muted">{timeAgo(e.processed_at)}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Which suggestions work</h2>
        <RecommendationStats />
      </section>
    </div>
  );
}
