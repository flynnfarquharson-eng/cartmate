import "server-only";
import { XMLParser } from "fast-xml-parser";

export type FeedEpisode = {
  guid: string;
  title: string;
  description: string | null;
  episodeUrl: string | null;
  publishedAt: Date | null;
  audioUrl: string | null;
  durationSeconds: number | null;
  transcriptUrl: string | null;
  transcriptType: string | null;
};

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  textNodeName: "#text",
  // Some feeds have 1 item, some have many: always give us an array.
  isArray: (name) => name === "item" || name === "podcast:transcript",
  processEntities: true,
  htmlEntities: true,
});

function text(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "string") return value.trim() || null;
  if (typeof value === "number") return String(value);
  if (typeof value === "object" && "#text" in (value as object)) {
    return text((value as Record<string, unknown>)["#text"]);
  }
  return null;
}

/** "01:02:03", "62:03", "3723" -> seconds */
export function parseDuration(value: unknown): number | null {
  const raw = text(value);
  if (!raw) return null;
  const parts = raw.split(":").map((p) => Number(p));
  if (parts.some((n) => Number.isNaN(n))) return null;
  const seconds = parts.reduce((total, n) => total * 60 + n, 0);
  return seconds > 0 ? Math.round(seconds) : null;
}

function stripHtml(html: string | null, maxLength = 1000): string | null {
  if (!html) return null;
  const plain = html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  return plain.length > maxLength ? plain.slice(0, maxLength - 1) + "…" : plain || null;
}

// Prefer transcript formats that include timestamps.
const TRANSCRIPT_PREFERENCE = [
  "application/json",
  "text/vtt",
  "application/x-subrip",
  "application/srt",
  "text/srt",
  "text/html",
  "text/plain",
];

function pickTranscript(tags: unknown): { url: string; type: string } | null {
  if (!Array.isArray(tags)) return null;
  const options = tags
    .map((t) => ({ url: t?.["@_url"] as string, type: String(t?.["@_type"] ?? "").toLowerCase() }))
    .filter((t) => t.url);
  if (!options.length) return null;
  const rank = (type: string) => {
    const i = TRANSCRIPT_PREFERENCE.indexOf(type);
    return i === -1 ? TRANSCRIPT_PREFERENCE.length : i;
  };
  return options.sort((a, b) => rank(a.type) - rank(b.type))[0];
}

export function parseFeed(xml: string): FeedEpisode[] {
  const doc = parser.parse(xml);
  const items: Record<string, unknown>[] = doc?.rss?.channel?.item ?? [];

  return items
    .map((item): FeedEpisode | null => {
      const enclosure = item.enclosure as Record<string, string> | undefined;
      const audioUrl = enclosure?.["@_url"] ?? null;
      const guid = text(item.guid) ?? audioUrl ?? text(item.link);
      if (!guid) return null;

      const pubDate = text(item.pubDate);
      const published = pubDate ? new Date(pubDate) : null;
      const transcript = pickTranscript(item["podcast:transcript"]);

      return {
        guid,
        title: text(item.title) ?? text(item["itunes:title"]) ?? "Untitled episode",
        description: stripHtml(text(item.description) ?? text(item["itunes:summary"])),
        episodeUrl: text(item.link),
        publishedAt: published && !Number.isNaN(published.getTime()) ? published : null,
        audioUrl,
        durationSeconds: parseDuration(item["itunes:duration"]),
        transcriptUrl: transcript?.url ?? null,
        transcriptType: transcript?.type || null,
      };
    })
    .filter((e): e is FeedEpisode => e !== null);
}
