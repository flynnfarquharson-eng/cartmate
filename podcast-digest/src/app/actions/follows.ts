"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPodcastByFeedUrl, getPodcastByItunesId } from "@/lib/podcast-index";
import { lookupApple } from "@/lib/apple";
import { getFeedEpisodes, importEpisode, pollPodcastById } from "@/lib/poll";
import { MAX_ATTEMPTS, MAX_EPISODE_MINUTES, processEpisodeById, processPendingForPodcast } from "@/lib/process";
import { recordEvent } from "@/lib/tracking";
import type { RecSource } from "@/lib/types";

type ActionResult = { ok: true; podcastId: string } | { ok: false; error: string };

/**
 * Follow a show by its Apple Podcasts id. `source` records where the person found
 * it (a recommendation, a chart, search...) so we can see which suggestions work.
 */
export async function followPodcast(itunesId: number, source: RecSource = "search"): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Please log in again." };

  // Look the show up ourselves rather than trusting data sent from the browser.
  // Podcast Index knows most shows by Apple id; otherwise match on the feed URL Apple lists.
  let show = await getPodcastByItunesId(itunesId);
  const apple = (await lookupApple([itunesId]))[0];
  if (!show && apple?.feedUrl) show = await getPodcastByFeedUrl(apple.feedUrl);
  if (!show || !show.rssUrl) return { ok: false, error: "Couldn't find that podcast's feed." };

  // One shared row per show, no matter how many people follow it.
  const admin = createAdminClient();
  const { data: podcast, error } = await admin
    .from("podcasts")
    .upsert(
      {
        podcast_index_id: show.podcastIndexId,
        itunes_id: itunesId,
        title: show.title,
        author: show.author,
        description: show.description,
        image_url: show.imageUrl || apple?.imageUrl || null,
        rss_url: show.rssUrl,
        website_url: show.websiteUrl,
      },
      { onConflict: "podcast_index_id" },
    )
    .select("id, import_after")
    .single();
  if (error || !podcast) return { ok: false, error: error?.message ?? "Couldn't save podcast." };

  const { error: followError } = await supabase
    .from("user_follows")
    .upsert({ user_id: user.id, podcast_id: podcast.id }, { onConflict: "user_id,podcast_id" });
  if (followError) return { ok: false, error: followError.message };

  // Measurement only: never let it block the follow.
  await supabase.from("recommendations").upsert(
    {
      user_id: user.id,
      itunes_id: itunesId,
      source,
      title: show.title,
      author: show.author,
      image_url: show.imageUrl || apple?.imageUrl || null,
      followed_at: new Date().toISOString(),
    },
    { onConflict: "user_id,itunes_id,source" },
  );

  // First time anyone has followed this show: grab its latest episode right away,
  // then summarise it in the background so it's ready in a minute or two rather
  // than after the next scheduled run.
  if (!podcast.import_after) {
    await pollPodcastById(podcast.id);
    after(async () => {
      try {
        const results = await processPendingForPodcast(podcast.id);
        console.log("[follow] summarised new show:", JSON.stringify(results));
      } catch (err) {
        console.error("[follow] background summarise failed:", err);
      }
    });
  }

  revalidatePath("/settings");
  revalidatePath("/feed");
  revalidatePath("/discover");
  return { ok: true, podcastId: podcast.id };
}

/** Back-catalogue summaries one person can ask for in 24 hours (each costs ~US$0.15-0.45). */
const SUMMARY_REQUESTS_PER_DAY = 10;

type SummaryResult = { ok: true; episodeId: string; ready: boolean } | { ok: false; error: string };

/**
 * Summarise one episode someone picked from a show's episode list. Follows the
 * show first if needed, then summarises in the background (about a minute).
 */
export async function requestSummary(itunesId: number, guid: string): Promise<SummaryResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Please log in again." };

  const admin = createAdminClient();
  const { data: stored } = await admin.from("podcasts").select("id, rss_url").eq("itunes_id", itunesId).maybeSingle();
  let podcast = stored;
  const { data: follow } = podcast
    ? await supabase.from("user_follows").select("podcast_id").eq("podcast_id", podcast.id).maybeSingle()
    : { data: null };
  if (!follow) {
    const followed = await followPodcast(itunesId, "search");
    if (!followed.ok) return followed;
    const { data } = await admin.from("podcasts").select("id, rss_url").eq("id", followed.podcastId).single();
    podcast = data;
  }
  if (!podcast) return { ok: false, error: "Couldn't find that podcast." };
  const { data: optout } = await admin.from("creator_optouts").select("podcast_id").eq("podcast_id", podcast.id).maybeSingle();
  if (optout) return { ok: false, error: "This show's creators have asked us not to summarise it." };

  const feedEpisode = (await getFeedEpisodes(podcast.rss_url).catch(() => [])).find((e) => e.guid === guid);
  if (!feedEpisode) return { ok: false, error: "Couldn't find that episode. Try again in a minute." };
  if (!feedEpisode.audioUrl) return { ok: false, error: "This episode has no audio we can use." };
  if ((feedEpisode.durationSeconds ?? 0) > MAX_EPISODE_MINUTES * 60) {
    return { ok: false, error: `Episodes over ${MAX_EPISODE_MINUTES / 60} hours can't be summarised yet.` };
  }

  const episodeId = await importEpisode(podcast.id, feedEpisode);
  const { data: episode } = await admin.from("episodes").select("status, attempts").eq("id", episodeId).single();
  if (episode?.status === "done") return { ok: true, episodeId, ready: true };
  if (episode?.status === "transcribing" || episode?.status === "summarising") {
    return { ok: true, episodeId, ready: false };
  }
  if (episode?.status === "failed" && episode.attempts >= MAX_ATTEMPTS) {
    return { ok: false, error: "We couldn't summarise this episode." };
  }

  // Cost guard per person, on top of the daily cap for everyone.
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { count } = await admin
    .from("product_events")
    .select("id", { count: "exact", head: true })
    .eq("event", "summary_request")
    .eq("user_id", user.id)
    .gte("created_at", since);
  if ((count ?? 0) >= SUMMARY_REQUESTS_PER_DAY) {
    return { ok: false, error: `You can get ${SUMMARY_REQUESTS_PER_DAY} older episodes a day. Try again tomorrow.` };
  }
  await recordEvent("summary_request", { userId: user.id, props: { episodeId } });

  after(async () => {
    try {
      const result = await processEpisodeById(episodeId);
      console.log("[request] summarised:", JSON.stringify(result));
    } catch (err) {
      console.error("[request] summarise failed:", err);
    }
  });

  revalidatePath("/feed");
  revalidatePath("/library");
  return { ok: true, episodeId, ready: false };
}

export async function unfollowPodcast(podcastId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Please log in again." };

  const { error } = await supabase
    .from("user_follows")
    .delete()
    .eq("user_id", user.id)
    .eq("podcast_id", podcastId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/settings");
  revalidatePath("/feed");
  revalidatePath("/discover");
  return { ok: true, podcastId };
}
