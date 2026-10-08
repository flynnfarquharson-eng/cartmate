import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseFeed } from "@/lib/rss";

/**
 * When someone follows a brand-new show, import only this many recent episodes.
 * Each one gets summarised, so this is the main cost of a new follow.
 */
const INITIAL_EPISODES = 1;
/** Safety cap: never import more than this many episodes from one feed in one check. */
const MAX_NEW_PER_POLL = 10;
/** How many feeds to download at the same time. */
const CONCURRENCY = 5;

type PodcastRow = {
  id: string;
  title: string;
  rss_url: string;
  import_after: string | null;
  feed_etag: string | null;
  feed_last_modified: string | null;
};

export type PollResult = {
  podcastId: string;
  title: string;
  newEpisodes: number;
  notModified?: boolean;
  error?: string;
};

const PODCAST_COLUMNS = "id, title, rss_url, import_after, feed_etag, feed_last_modified";

/**
 * Check one show's RSS feed and save any new episodes as "pending".
 * Safe to run any number of times: the database refuses duplicate (show, guid) pairs.
 */
export async function pollPodcast(podcast: PodcastRow): Promise<PollResult> {
  const db = createAdminClient();
  const result: PollResult = { podcastId: podcast.id, title: podcast.title, newEpisodes: 0 };
  const firstImport = !podcast.import_after;

  try {
    const headers: Record<string, string> = {
      "User-Agent": "PodcastDigest/0.1 (+RSS reader)",
      Accept: "application/rss+xml, application/xml;q=0.9, */*;q=0.8",
    };
    if (!firstImport) {
      if (podcast.feed_etag) headers["If-None-Match"] = podcast.feed_etag;
      if (podcast.feed_last_modified) headers["If-Modified-Since"] = podcast.feed_last_modified;
    }

    const res = await fetch(podcast.rss_url, {
      headers,
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    });

    if (res.status === 304) {
      await db
        .from("podcasts")
        .update({ last_checked_at: new Date().toISOString(), last_check_error: null })
        .eq("id", podcast.id);
      return { ...result, notModified: true };
    }
    if (!res.ok) throw new Error(`Feed returned HTTP ${res.status}`);

    const episodes = parseFeed(await res.text()).sort(
      (a, b) => (b.publishedAt?.getTime() ?? 0) - (a.publishedAt?.getTime() ?? 0),
    );

    let importAfter = podcast.import_after;
    let toImport;
    if (firstImport) {
      toImport = episodes.slice(0, INITIAL_EPISODES);
      const oldest = toImport.at(-1)?.publishedAt;
      importAfter = (oldest ?? new Date()).toISOString();
    } else {
      const cutoff = new Date(podcast.import_after!).getTime();
      toImport = episodes
        .filter((e) => e.publishedAt && e.publishedAt.getTime() >= cutoff)
        .slice(0, MAX_NEW_PER_POLL);
    }

    if (toImport.length) {
      const { data, error } = await db
        .from("episodes")
        .upsert(
          toImport.map((e) => ({
            podcast_id: podcast.id,
            guid: e.guid,
            title: e.title,
            description: e.description,
            episode_url: e.episodeUrl,
            published_at: e.publishedAt?.toISOString() ?? null,
            audio_url: e.audioUrl,
            duration_seconds: e.durationSeconds,
            feed_transcript_url: e.transcriptUrl,
            feed_transcript_type: e.transcriptType,
          })),
          { onConflict: "podcast_id,guid", ignoreDuplicates: true },
        )
        .select("id");
      if (error) throw new Error(`Saving episodes failed: ${error.message}`);
      result.newEpisodes = data?.length ?? 0;
    }

    await db
      .from("podcasts")
      .update({
        import_after: importAfter,
        feed_etag: res.headers.get("etag"),
        feed_last_modified: res.headers.get("last-modified"),
        last_checked_at: new Date().toISOString(),
        last_check_error: null,
      })
      .eq("id", podcast.id);

    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[poll] ${podcast.title}: ${message}`);
    await db
      .from("podcasts")
      .update({ last_checked_at: new Date().toISOString(), last_check_error: message })
      .eq("id", podcast.id);
    return { ...result, error: message };
  }
}

export async function pollPodcastById(podcastId: string): Promise<PollResult> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("podcasts")
    .select(PODCAST_COLUMNS)
    .eq("id", podcastId)
    .single();
  if (error || !data) throw new Error(`Podcast ${podcastId} not found`);
  return pollPodcast(data);
}

/** Check every show that at least one user follows. */
export async function pollAllFollowedPodcasts(): Promise<PollResult[]> {
  const db = createAdminClient();

  const { data: follows, error: followsError } = await db.from("user_follows").select("podcast_id");
  if (followsError) throw new Error(followsError.message);
  const ids = [...new Set((follows ?? []).map((f) => f.podcast_id as string))];
  if (!ids.length) return [];

  const { data: podcasts, error } = await db.from("podcasts").select(PODCAST_COLUMNS).in("id", ids);
  if (error) throw new Error(error.message);

  const queue = [...(podcasts ?? [])];
  const results: PollResult[] = [];
  const workers = Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async () => {
    for (let p = queue.shift(); p; p = queue.shift()) {
      results.push(await pollPodcast(p));
    }
  });
  await Promise.all(workers);
  return results;
}
