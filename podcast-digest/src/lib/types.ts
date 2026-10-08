// Shapes of the JSON columns in `summaries`, as written by src/lib/summarise.ts.

export type KeyIdea = { title: string; detail: string };
export type Quote = { quote: string; speaker: string | null; timestamp_seconds: number | null };
export type Resource = { name: string; type: string; url: string | null };

export type TipRow = {
  id: string;
  tip_text: string;
  category: string | null;
  timestamp_seconds: number | null;
};

/** Where someone found a show. Matches the check constraint in 002_discovery.sql. */
export type RecSource = "claude" | "friends" | "chart" | "search" | "link";

/** A show as shown in search results, recommendations and charts (Apple Podcasts data). */
export type ShowSummary = {
  itunesId: number;
  title: string;
  author: string;
  imageUrl: string | null;
  reason?: string | null;
  latestEpisodeAt?: string | null;
};
