import "server-only";

// Apple's public podcast directory. Free, no key. Much better search ranking than
// Podcast Index, and real Australian top charts. We still get the RSS feed itself
// from Podcast Index when someone follows a show.
// Docs: https://performance-partners.apple.com/search-api

const COUNTRY = "au";

export type AppleShow = {
  itunesId: number;
  title: string;
  author: string;
  imageUrl: string | null;
  genre: string | null;
  feedUrl: string | null;
  /** Date of the newest episode, when Apple tells us. */
  latestEpisodeAt: string | null;
};

type AppleResult = {
  collectionId: number;
  collectionName: string;
  artistName: string;
  artworkUrl600?: string;
  artworkUrl100?: string;
  primaryGenreName?: string;
  feedUrl?: string;
  releaseDate?: string;
};

function toShow(r: AppleResult): AppleShow {
  return {
    itunesId: r.collectionId,
    title: r.collectionName,
    author: r.artistName,
    imageUrl: r.artworkUrl600 ?? r.artworkUrl100 ?? null,
    genre: r.primaryGenreName ?? null,
    feedUrl: r.feedUrl ?? null,
    latestEpisodeAt: r.releaseDate ?? null,
  };
}

async function getJson<T>(url: string, revalidateSeconds: number): Promise<T> {
  const res = await fetch(url, {
    headers: { "User-Agent": "PodcastDigest/0.1" },
    signal: AbortSignal.timeout(10_000),
    next: { revalidate: revalidateSeconds },
  });
  if (!res.ok) throw new Error(`Apple Podcasts returned HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

export async function searchApple(term: string, limit = 20): Promise<AppleShow[]> {
  const params = new URLSearchParams({ term, entity: "podcast", country: COUNTRY, limit: String(limit) });
  const data = await getJson<{ results: AppleResult[] }>(`https://itunes.apple.com/search?${params}`, 3600);
  return data.results.filter((r) => r.feedUrl).map(toShow);
}

export async function lookupApple(itunesIds: number[]): Promise<AppleShow[]> {
  if (!itunesIds.length) return [];
  const params = new URLSearchParams({ id: itunesIds.join(","), entity: "podcast", country: COUNTRY });
  const data = await getJson<{ results: AppleResult[] }>(`https://itunes.apple.com/lookup?${params}`, 3600);
  return data.results.filter((r) => r.collectionId).map(toShow);
}

type ChartEntry = {
  id: { attributes: { "im:id": string } };
  "im:name": { label: string };
  "im:artist"?: { label: string };
  "im:image"?: { label: string }[];
};

/** Australian top podcasts, optionally for one Apple genre. Refreshed every 6 hours. */
export async function topChart(genreId: number | null, limit = 15): Promise<AppleShow[]> {
  const genre = genreId ? `/genre=${genreId}` : "";
  const data = await getJson<{ feed?: { entry?: ChartEntry[] | ChartEntry } }>(
    `https://itunes.apple.com/${COUNTRY}/rss/toppodcasts/limit=${limit}${genre}/json`,
    6 * 3600,
  );
  const entries = data.feed?.entry ?? [];
  return (Array.isArray(entries) ? entries : [entries]).map((e) => ({
    itunesId: Number(e.id.attributes["im:id"]),
    title: e["im:name"].label,
    author: e["im:artist"]?.label ?? "",
    imageUrl: e["im:image"]?.at(-1)?.label ?? null,
    genre: null,
    feedUrl: null,
    latestEpisodeAt: null,
  }));
}

function decodeHtml(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

/** Lowercase, drop punctuation and filler words, for comparing show names. */
export function normaliseTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\b(the|podcast|show|with)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Find the real Apple listing for a show name (e.g. one Claude suggested).
 * Returns null unless the name genuinely matches, so made-up shows are dropped.
 */
export async function findShowByName(title: string, author?: string | null): Promise<AppleShow | null> {
  const wanted = normaliseTitle(title);
  if (!wanted) return null;
  const candidates = await searchApple(author ? `${title} ${author}` : title, 10);
  const more = author ? await searchApple(title, 10) : [];
  for (const show of [...candidates, ...more]) {
    const got = normaliseTitle(show.title);
    if (got === wanted || got.startsWith(wanted + " ") || wanted.startsWith(got + " ")) return show;
  }
  return null;
}

/**
 * Turn a pasted Apple Podcasts or Spotify link into an Apple show.
 * Apple links contain the id directly. Spotify links only give us the name,
 * which we then look up on Apple.
 */
export async function resolveShowLink(input: string): Promise<AppleShow | null> {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return null;
  }

  if (url.hostname.endsWith("podcasts.apple.com") || url.hostname.endsWith("itunes.apple.com")) {
    const id = url.pathname.match(/id(\d+)/)?.[1];
    return id ? ((await lookupApple([Number(id)]))[0] ?? null) : null;
  }

  if (url.hostname.endsWith("spotify.com") || url.hostname === "spotify.link") {
    // Spotify's oEmbed gives the latest episode's title, not the show's, so read the
    // show page's og:title instead. Short spotify.link URLs redirect to the show page.
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; PodcastDigest/0.1)" },
      redirect: "follow",
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    const path = new URL(res.url).pathname;
    const html = await res.text();
    let title: string | undefined;
    if (path.startsWith("/show/")) {
      title = html.match(/<meta property="og:title" content="([^"]+)"/)?.[1];
    } else if (path.startsWith("/episode/")) {
      // Episode pages say "Listen to this episode from <Show> on Spotify."
      title = html.match(/Listen to this episode from (.+?) on Spotify/)?.[1];
    }
    return title ? findShowByName(decodeHtml(title)) : null;
  }

  return null;
}
