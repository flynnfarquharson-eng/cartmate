import "server-only";
import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type FollowedShows = {
  /** Apple id -> our podcast id, for showing "Following" on cards. */
  byItunesId: Record<number, string>;
  titles: string[];
  podcastIds: string[];
};

export async function getFollowedShows(supabase: Supabase): Promise<FollowedShows> {
  const { data } = await supabase.from("user_follows").select("podcast_id, podcasts(itunes_id, title)");
  const result: FollowedShows = { byItunesId: {}, titles: [], podcastIds: [] };
  for (const row of data ?? []) {
    const p = row.podcasts as unknown as { itunes_id: number | null; title: string } | null;
    result.podcastIds.push(row.podcast_id);
    if (p?.title) result.titles.push(p.title);
    if (p?.itunes_id) result.byItunesId[p.itunes_id] = row.podcast_id;
  }
  return result;
}
