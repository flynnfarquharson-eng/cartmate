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
  };
}

export async function searchPodcasts(term: string): Promise<PodcastSearchResult[]> {
  const data = await call<{ feeds: PodcastIndexFeed[] }>("/search/byterm", {
    q: term,
    max: "20",
  });
  return (data.feeds ?? []).map(toSearchResult);
}

export async function getPodcastById(id: number): Promise<PodcastSearchResult | null> {
  const data = await call<{ feed: PodcastIndexFeed | [] }>("/podcasts/byfeedid", {
    id: String(id),
  });
  // The API returns an empty array instead of an object when not found.
  if (!data.feed || Array.isArray(data.feed)) return null;
  return toSearchResult(data.feed);
}
