import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTranscript, formatForSummary, type Segment, type Transcript } from "@/lib/transcript";
import { summariseEpisode } from "@/lib/summarise";

/** Episodes handled per run. Each can take 1-3 minutes, and a run gets 5 minutes. */
const BATCH_SIZE = 2;
/** Give up on an episode after this many tries. */
const MAX_ATTEMPTS = 3;
/** An episode stuck "in progress" this long was abandoned by a crashed run. */
const STALE_AFTER_MS = 15 * 60 * 1000;
/** Cost guard: skip episodes longer than this (minutes) rather than pay to transcribe them. */
const MAX_EPISODE_MINUTES = 240;
/**
 * Cost guard: never start more than this many episodes in 24 hours, across everyone.
 * At roughly US$0.15-0.45 each, 30 a day is at most ~US$13. Override with MAX_EPISODES_PER_DAY.
 */
const MAX_EPISODES_PER_DAY = Number(process.env.MAX_EPISODES_PER_DAY) || 30;

type EpisodeRow = {
  id: string;
  podcast_id: string;
  title: string;
  description: string | null;
  audio_url: string | null;
  duration_seconds: number | null;
  feed_transcript_url: string | null;
  feed_transcript_type: string | null;
  status: string;
  attempts: number;
  processing_started_at: string | null;
  podcasts: { title: string } | null;
};

export type ProcessResult = { episodeId: string; title: string; status: "done" | "failed" | "skipped"; error?: string };

const EPISODE_COLUMNS =
  "id, podcast_id, title, description, audio_url, duration_seconds, feed_transcript_url, feed_transcript_type, status, attempts, processing_started_at, podcasts(title)";

type Db = ReturnType<typeof createAdminClient>;

/** Find episodes that need work: new ones, failed ones with tries left, and ones a crashed run left behind. */
async function findCandidates(db: Db, limit: number): Promise<EpisodeRow[]> {
  // Only spend money on shows someone still follows.
  const { data: follows, error: followsError } = await db.from("user_follows").select("podcast_id");
  if (followsError) throw new Error(followsError.message);
  const followed = [...new Set((follows ?? []).map((f) => f.podcast_id as string))];
  if (!followed.length) return [];

  const staleBefore = new Date(Date.now() - STALE_AFTER_MS).toISOString();
  const { data, error } = await db
    .from("episodes")
    .select(EPISODE_COLUMNS)
    .in("podcast_id", followed)
    .lt("attempts", MAX_ATTEMPTS)
    .or(
      `status.eq.pending,status.eq.failed,and(status.in.(transcribing,summarising),processing_started_at.lt."${staleBefore}")`,
    )
    // Newest first: people care most about this week's episodes.
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(limit * 3);
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as EpisodeRow[];
}

/**
 * Atomically take an episode so two runs can never process (and pay for) it twice.
 * The update only matches if nobody else changed the row since we read it.
 */
async function claim(db: Db, episode: EpisodeRow): Promise<boolean> {
  let query = db
    .from("episodes")
    .update({
      status: "transcribing",
      attempts: episode.attempts + 1,
      processing_started_at: new Date().toISOString(),
      error: null,
    })
    .eq("id", episode.id)
    .eq("status", episode.status)
    .eq("attempts", episode.attempts);
  query = episode.processing_started_at
    ? query.eq("processing_started_at", episode.processing_started_at)
    : query.is("processing_started_at", null);
  const { data, error } = await query.select("id");
  if (error) throw new Error(error.message);
  return (data?.length ?? 0) > 0;
}

/** Reuse a transcript saved by an earlier attempt, so a retry never pays Deepgram twice. */
async function loadOrCreateTranscript(db: Db, episode: EpisodeRow): Promise<Transcript> {
  const { data: saved } = await db
    .from("episode_transcripts")
    .select("source, text, segments")
    .eq("episode_id", episode.id)
    .maybeSingle();
  if (saved) {
    return { source: saved.source, text: saved.text, segments: saved.segments as Segment[] | null };
  }

  const transcript = await getTranscript(episode);
  const { error } = await db.from("episode_transcripts").upsert({
    episode_id: episode.id,
    source: transcript.source,
    text: transcript.text,
    segments: transcript.segments,
  });
  if (error) throw new Error(`Saving transcript failed: ${error.message}`);
  await db.from("episodes").update({ transcript_source: transcript.source }).eq("id", episode.id);
  return transcript;
}

async function processEpisode(db: Db, episode: EpisodeRow): Promise<ProcessResult> {
  const result = { episodeId: episode.id, title: episode.title };
  try {
    const transcript = await loadOrCreateTranscript(db, episode);

    await db.from("episodes").update({ status: "summarising" }).eq("id", episode.id);
    const summary = await summariseEpisode({
      podcastTitle: episode.podcasts?.title ?? "",
      episodeTitle: episode.title,
      description: episode.description,
      transcript: formatForSummary(transcript),
    });

    const { error: summaryError } = await db.from("summaries").upsert(
      {
        episode_id: episode.id,
        overview: summary.overview,
        key_ideas: summary.key_ideas,
        quotes_with_timestamps: summary.quotes,
        resources_mentioned: summary.resources,
      },
      { onConflict: "episode_id" },
    );
    if (summaryError) throw new Error(`Saving summary failed: ${summaryError.message}`);

    // Replace rather than append, so a retry doesn't duplicate tips.
    await db.from("tips").delete().eq("episode_id", episode.id);
    if (summary.tips.length) {
      const { error: tipsError } = await db.from("tips").insert(
        summary.tips.map((t) => ({
          episode_id: episode.id,
          tip_text: t.tip,
          category: t.category,
          timestamp_seconds: t.timestamp_seconds,
        })),
      );
      if (tipsError) throw new Error(`Saving tips failed: ${tipsError.message}`);
    }

    await db
      .from("episodes")
      .update({ status: "done", processed_at: new Date().toISOString(), error: null })
      .eq("id", episode.id);
    return { ...result, status: "done" };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[process] ${episode.title}: ${message}`);
    await db.from("episodes").update({ status: "failed", error: message }).eq("id", episode.id);
    return { ...result, status: "failed", error: message };
  }
}

/** How many more episodes we may start today before hitting the daily cap. */
async function dailyAllowance(db: Db): Promise<number> {
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { count, error } = await db
    .from("episodes")
    .select("id", { count: "exact", head: true })
    .gte("processing_started_at", since);
  if (error) throw new Error(error.message);
  const left = MAX_EPISODES_PER_DAY - (count ?? 0);
  if (left <= 0) console.warn(`[process] daily cap of ${MAX_EPISODES_PER_DAY} episodes reached, waiting`);
  return Math.max(0, left);
}

/** Process one specific episode now (e.g. an admin retry). Still claims it, so it can't run twice. */
export async function processEpisodeById(episodeId: string): Promise<ProcessResult> {
  const db = createAdminClient();
  const { data, error } = await db.from("episodes").select(EPISODE_COLUMNS).eq("id", episodeId).single();
  if (error || !data) throw new Error(`Episode ${episodeId} not found`);
  const episode = data as unknown as EpisodeRow;
  if (!(await dailyAllowance(db))) {
    return { episodeId, title: episode.title, status: "skipped", error: "Daily limit reached" };
  }
  if (!(await claim(db, episode))) {
    return { episodeId, title: episode.title, status: "skipped", error: "Already being processed" };
  }
  return processEpisode(db, episode);
}

/** Process the next few episodes that need summarising. Safe to run as often as you like. */
export async function processPendingEpisodes(limit = BATCH_SIZE): Promise<ProcessResult[]> {
  const db = createAdminClient();
  const results: ProcessResult[] = [];
  limit = Math.min(limit, await dailyAllowance(db));
  if (!limit) return results;

  for (const episode of await findCandidates(db, limit)) {
    if (results.filter((r) => r.status !== "skipped").length >= limit) break;

    if (episode.duration_seconds && episode.duration_seconds > MAX_EPISODE_MINUTES * 60) {
      await db
        .from("episodes")
        .update({
          status: "failed",
          attempts: MAX_ATTEMPTS,
          error: `Longer than ${MAX_EPISODE_MINUTES} minutes, skipped to save cost.`,
        })
        .eq("id", episode.id);
      results.push({ episodeId: episode.id, title: episode.title, status: "skipped", error: "Too long" });
      continue;
    }

    if (!(await claim(db, episode))) continue; // another run got it first
    results.push(await processEpisode(db, episode));
  }
  return results;
}

/**
 * Summarise a show's pending episodes straight away, e.g. right after the first
 * person follows it, so they don't wait for the next scheduled run.
 */
export async function processPendingForPodcast(podcastId: string): Promise<ProcessResult[]> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("episodes")
    .select("id")
    .eq("podcast_id", podcastId)
    .eq("status", "pending")
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(BATCH_SIZE);
  if (error) throw new Error(error.message);
  const results: ProcessResult[] = [];
  for (const { id } of data ?? []) results.push(await processEpisodeById(id));
  return results;
}
