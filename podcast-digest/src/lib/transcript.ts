import "server-only";
import { requireEnv } from "@/lib/env";
import { formatTimestamp } from "@/lib/format";

export type Segment = { start: number; end: number; text: string };

export type Transcript = {
  source: "feed" | "deepgram";
  text: string;
  /** Null when the transcript has no timestamps (plain text / HTML feeds). */
  segments: Segment[] | null;
};

type EpisodeForTranscript = {
  audio_url: string | null;
  feed_transcript_url: string | null;
  feed_transcript_type: string | null;
};

/**
 * Get a transcript for an episode. Uses the show's own transcript when the feed
 * publishes one (free), and only falls back to paid Deepgram transcription.
 */
export async function getTranscript(episode: EpisodeForTranscript): Promise<Transcript> {
  if (episode.feed_transcript_url) {
    try {
      const fromFeed = await fetchFeedTranscript(
        episode.feed_transcript_url,
        episode.feed_transcript_type,
      );
      // Some feeds link to empty or placeholder files. Only trust a real transcript.
      if (fromFeed.text.length > 500) return fromFeed;
    } catch (err) {
      console.warn(`[transcript] feed transcript failed, using Deepgram: ${String(err)}`);
    }
  }
  if (!episode.audio_url) throw new Error("Episode has no audio file and no transcript.");
  return transcribeWithDeepgram(episode.audio_url);
}

// ─────────────────────────────────────────────────────────────
// Feed transcripts (Podcasting 2.0 <podcast:transcript>)
// ─────────────────────────────────────────────────────────────

async function fetchFeedTranscript(url: string, type: string | null): Promise<Transcript> {
  const res = await fetch(url, {
    headers: { "User-Agent": "PodcastDigest/0.1" },
    signal: AbortSignal.timeout(30_000),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Transcript returned HTTP ${res.status}`);
  const body = await res.text();
  const kind = (type ?? res.headers.get("content-type") ?? "").toLowerCase();

  let segments: Segment[] | null = null;
  if (kind.includes("json")) segments = parseJsonTranscript(body);
  else if (kind.includes("vtt") || body.trimStart().startsWith("WEBVTT")) segments = parseCues(body);
  else if (kind.includes("srt") || kind.includes("subrip")) segments = parseCues(body);

  if (segments) {
    return { source: "feed", text: segments.map((s) => s.text).join(" "), segments };
  }
  const plain = body.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  return { source: "feed", text: plain, segments: null };
}

function parseJsonTranscript(body: string): Segment[] {
  const data = JSON.parse(body) as { segments?: { startTime?: number; endTime?: number; body?: string }[] };
  return (data.segments ?? [])
    .filter((s) => s.body?.trim())
    .map((s) => ({ start: s.startTime ?? 0, end: s.endTime ?? s.startTime ?? 0, text: s.body!.trim() }));
}

/** "00:01:02.500" / "01:02,500" / "62.5" -> seconds */
function parseTimestamp(value: string): number {
  const parts = value.trim().replace(",", ".").split(":").map(Number);
  return parts.reduce((total, n) => total * 60 + n, 0);
}

/** Parses both WebVTT and SRT: blocks of "start --> end" followed by text lines. */
function parseCues(body: string): Segment[] {
  const segments: Segment[] = [];
  for (const block of body.replace(/\r/g, "").split(/\n{2,}/)) {
    const lines = block.split("\n");
    const timing = lines.findIndex((l) => l.includes("-->"));
    if (timing === -1) continue;
    const [startRaw, endRaw] = lines[timing].split("-->");
    const text = lines
      .slice(timing + 1)
      .join(" ")
      .replace(/<[^>]*>/g, "")
      .trim();
    if (!text) continue;
    segments.push({
      start: parseTimestamp(startRaw),
      end: parseTimestamp(endRaw.trim().split(/\s/)[0]),
      text,
    });
  }
  return segments;
}

// ─────────────────────────────────────────────────────────────
// Deepgram (paid, ~US$0.0043 per audio minute on nova-3)
// Docs: https://developers.deepgram.com/reference/speech-to-text/listen-pre-recorded
// ─────────────────────────────────────────────────────────────

type DeepgramResponse = {
  results?: {
    channels?: { alternatives?: { transcript?: string }[] }[];
    utterances?: { start: number; end: number; transcript: string }[];
  };
};

async function transcribeWithDeepgram(audioUrl: string): Promise<Transcript> {
  const params = new URLSearchParams({
    model: "nova-3",
    smart_format: "true",
    punctuate: "true",
    utterances: "true",
  });
  // Deepgram downloads the audio itself, so we never pull large files through our server.
  const res = await fetch(`https://api.deepgram.com/v1/listen?${params}`, {
    method: "POST",
    headers: {
      Authorization: `Token ${requireEnv("DEEPGRAM_API_KEY")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ url: audioUrl }),
    signal: AbortSignal.timeout(240_000),
  });
  if (!res.ok) throw new Error(`Deepgram failed: HTTP ${res.status} ${await res.text()}`);

  const data = (await res.json()) as DeepgramResponse;
  const text = data.results?.channels?.[0]?.alternatives?.[0]?.transcript?.trim() ?? "";
  if (!text) throw new Error("Deepgram returned an empty transcript.");
  const segments = (data.results?.utterances ?? []).map((u) => ({
    start: u.start,
    end: u.end,
    text: u.transcript.trim(),
  }));
  return { source: "deepgram", text, segments: segments.length ? segments : null };
}

// ─────────────────────────────────────────────────────────────
// Formatting for the summariser
// ─────────────────────────────────────────────────────────────

/**
 * Turns segments into "[12:34] text" lines, merged into ~30 second chunks so
 * Claude can cite timestamps without paying for one timestamp per sentence.
 */
export function formatForSummary(transcript: { text: string; segments: Segment[] | null }): string {
  if (!transcript.segments?.length) return transcript.text;
  const lines: string[] = [];
  let chunkStart = transcript.segments[0].start;
  let chunk: string[] = [];
  for (const seg of transcript.segments) {
    if (chunk.length && seg.start - chunkStart >= 30) {
      lines.push(`[${formatTimestamp(chunkStart)}] ${chunk.join(" ")}`);
      chunk = [];
      chunkStart = seg.start;
    }
    chunk.push(seg.text);
  }
  if (chunk.length) lines.push(`[${formatTimestamp(chunkStart)}] ${chunk.join(" ")}`);
  return lines.join("\n");
}
