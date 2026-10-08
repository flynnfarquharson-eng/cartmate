import "server-only";
import { createHash } from "node:crypto";
import { requireEnv } from "@/lib/env";

// Docs: https://podcastindex-org.github.io/docs-api/
const BASE = "https://api.podcastindex.org/api/1.0";

export type PodcastIndexFeed = {
  id: number;
  title: string;
  author: string;
  description: string;
  image: string;
  artwork: string;
  url: string; // RSS feed URL
  link: string; // show website
  episodeCount?: number;
  itunesId?: number | null;
};

export type PodcastSearchResult = {
  podcastIndexId: number;
  title: string;
  author: string;
  description: string;
  imageUrl: string;
  rssUrl: string;
  websiteUrl: string;
  episodeCount: number | null;
  itunesId: number | null;
};

async function call<T>(path: string, params: Record<string, string>): Promise<T> {
  const key = requireEnv("PODCAST_INDEX_API_KEY");
  const secret = requireEnv("PODCAST_INDEX_API_SECRET");
  const authDate = Math.floor(Date.now() / 1000).toString();
  const authorization = createHash("sha1").update(key + secret + authDate).digest("hex");

  const url = `${BASE}${path}?${new URLSearchParams(params)}`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": "PodcastDigest/0.1",
      "X-Auth-Key": key,
      "X-Auth-Date": authDate,
      Authorization: authorization,
    },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    throw new Error(`Podcast Index ${path} failed: ${res.status} ${await res.text()}`);
  }
  return res.json() as Promise<T>;
}

export function toSearchResult(f: PodcastIndexFeed): PodcastSearchResult {
  return {
    podcastIndexId: f.id,
    title: f.title,
    author: f.author,
    description: f.description,
    imageUrl: f.artwork || f.image,
    rssUrl: f.url,
    websiteUrl: f.link,
    episodeCount: f.episodeCount ?? null,
    itunesId: f.itunesId ?? null,
  };
}

async function getPodcast(path: string, params: Record<string, string>): Promise<PodcastSearchResult | null> {
  const data = await call<{ feed: PodcastIndexFeed | [] }>(path, params);
  // The API returns an empty array instead of an object when not found.
  if (!data.feed || Array.isArray(data.feed)) return null;
  return toSearchResult(data.feed);
}

export function getPodcastById(id: number) {
  return getPodcast("/podcasts/byfeedid", { id: String(id) });
}

export function getPodcastByItunesId(itunesId: number) {
  return getPodcast("/podcasts/byitunesid", { id: String(itunesId) });
}

export function getPodcastByFeedUrl(url: string) {
  return getPodcast("/podcasts/byfeedurl", { url });
}

export type RecentEpisode = { title: string; publishedAt: string | null; durationSeconds: number | null };

/** Latest episodes of a show we don't store yet, for the preview page. */
export async function getRecentEpisodesByItunesId(itunesId: number, max = 5): Promise<RecentEpisode[]> {
  const data = await call<{ items?: { title: string; datePublished?: number; duration?: number }[] }>(
    "/episodes/byitunesid",
    { id: String(itunesId), max: String(max) },
  );
  return (data.items ?? []).map((e) => ({
    title: e.title,
    publishedAt: e.datePublished ? new Date(e.datePublished * 1000).toISOString() : null,
    durationSeconds: e.duration || null,
  }));
}
