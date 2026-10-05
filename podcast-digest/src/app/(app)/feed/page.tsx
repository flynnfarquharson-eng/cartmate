import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PodcastArt } from "@/components/PodcastArt";
import { StatusBadge } from "@/components/StatusBadge";
import { formatDuration, timeAgo } from "@/lib/format";

export const metadata = { title: "Feed · Podcast Digest" };

type EpisodeRow = {
  id: string;
  title: string;
  published_at: string | null;
  duration_seconds: number | null;
  status: string;
  episode_url: string | null;
  podcasts: { title: string; image_url: string | null } | null;
};

// Phase 1 version: lists the latest episodes from shows you follow, with their
// processing status. Phase 3 turns this into a feed of summaries.
export default async function FeedPage() {
  const supabase = await createClient();
  const { data: follows } = await supabase.from("user_follows").select("podcast_id");
  const ids = (follows ?? []).map((f) => f.podcast_id);

  if (!ids.length) {
    return (
      <div className="mt-16 text-center">
        <h1 className="text-xl font-semibold">Your feed is empty</h1>
        <p className="mt-2 text-muted">Follow a few podcasts to get started.</p>
        <Link
          href="/search"
          className="mt-6 inline-block rounded-full bg-accent px-5 py-2.5 font-medium text-white dark:text-black"
        >
          Find podcasts
        </Link>
      </div>
    );
  }

  const { data } = await supabase
    .from("episodes")
    .select("id, title, published_at, duration_seconds, status, episode_url, podcasts(title, image_url)")
    .in("podcast_id", ids)
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(50);
  const episodes = (data ?? []) as unknown as EpisodeRow[];

  return (
    <>
      <h1 className="mb-4 text-2xl font-semibold tracking-tight">Latest episodes</h1>
      <ul className="space-y-2">
        {episodes.map((e) => (
          <li key={e.id} className="flex gap-3 rounded-2xl border border-border bg-surface p-3">
            <PodcastArt src={e.podcasts?.image_url} alt={e.podcasts?.title ?? ""} size={48} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs text-muted">{e.podcasts?.title}</p>
              <p className="line-clamp-2 font-medium leading-snug">{e.title}</p>
              <div className="mt-1 flex items-center gap-2 text-xs text-muted">
                <StatusBadge status={e.status} />
                <span>{timeAgo(e.published_at)}</span>
                {e.duration_seconds ? <span>· {formatDuration(e.duration_seconds)}</span> : null}
              </div>
            </div>
          </li>
        ))}
      </ul>
      {!episodes.length && (
        <p className="mt-8 text-center text-sm text-muted">
          No episodes yet. New episodes appear here after the next feed check.
        </p>
      )}
    </>
  );
}
