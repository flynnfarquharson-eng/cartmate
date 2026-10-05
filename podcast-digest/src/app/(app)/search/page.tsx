import { createClient } from "@/lib/supabase/server";
import { SearchClient } from "@/components/SearchClient";

export const metadata = { title: "Search · Podcast Digest" };

export default async function SearchPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("user_follows")
    .select("podcast_id, podcasts(podcast_index_id)");

  // podcast_index_id -> our podcast id, so results show "Following" correctly
  const followed: Record<number, string> = {};
  for (const row of data ?? []) {
    const p = row.podcasts as unknown as { podcast_index_id: number } | null;
    if (p) followed[p.podcast_index_id] = row.podcast_id;
  }

  return (
    <>
      <h1 className="mb-4 text-2xl font-semibold tracking-tight">Find podcasts</h1>
      <SearchClient followed={followed} />
    </>
  );
}
