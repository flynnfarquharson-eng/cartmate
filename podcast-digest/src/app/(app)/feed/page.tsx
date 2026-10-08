import Link from "next/link";
import { redirect } from "next/navigation";
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
  podcasts: { title: string; image_url: string | null } | null;
  // One-to-one, but PostgREST may return it as an object or a 1-item array.
  summaries: { overview: string } | { overview: string }[] | null;
  tips: { count: number }[];
};

function overviewOf(e: EpisodeRow): string | null {
  const s = Array.isArray(e.summaries) ? e.summaries[0] : e.summaries;
  return s?.overview ?? null;
}

export default async function FeedPage() {
  const supabase = await createClient();
  const { data: follows } = await supabase.from("user_follows").select("podcast_id");
  const ids = (follows ?? []).map((f) => f.podcast_id);

  if (!ids.length) {
    // Brand-new users start on the welcome screen.
    const { data: prefs } = await supabase.from("user_preferences").select("user_id").maybeSingle();
    if (!prefs) redirect("/welcome");
    return (
      <div className="mt-16 text-center">
        <h1 className="text-xl font-semibold">Your feed is empty</h1>
        <p className="mt-2 text-muted">Follow a few podcasts to get started.</p>
        <Link
          href="/discover"
          className="mt-6 inline-block rounded-full bg-accent px-5 py-2.5 font-medium text-white dark:text-black"
        >
          Find podcasts
        </Link>
      </div>
    );
  }

  const { data } = await supabase
    .from("episodes")
    .select(
      "id, title, published_at, duration_seconds, status, podcasts(title, image_url), summaries(overview), tips(count)",
    )
    .in("podcast_id", ids)
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(50);
  const episodes = (data ?? []) as unknown as EpisodeRow[];

  return (
    <>
      <h1 className="mb-4 text-2xl font-semibold tracking-tight">Latest episodes</h1>
      <ul className="space-y-3">
        {episodes.map((e) => {
          const overview = overviewOf(e);
          const tipCount = e.tips?.[0]?.count ?? 0;
          return (
            <li key={e.id}>
              <Link
                href={`/episode/${e.id}`}
                className="block rounded-2xl border border-border bg-surface p-4 transition hover:border-accent"
              >
                <div className="flex gap-3">
                  <PodcastArt src={e.podcasts?.image_url} alt={e.podcasts?.title ?? ""} size={48} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs text-muted">
                      {e.podcasts?.title} · {timeAgo(e.published_at)}
                      {e.duration_seconds ? ` · ${formatDuration(e.duration_seconds)}` : ""}
                    </p>
                    <p className="line-clamp-2 font-medium leading-snug">{e.title}</p>
                  </div>
                </div>
                {overview ? (
                  <>
                    <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-muted">{overview}</p>
                    <p className="mt-2 text-xs font-medium text-accent">
                      {tipCount ? `${tipCount} tips · ` : ""}Read summary →
                    </p>
                  </>
                ) : (
                  <div className="mt-2">
                    <StatusBadge status={e.status} />
                  </div>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
      {!episodes.length && (
        <p className="mt-8 text-center text-sm text-muted">
          No episodes yet. New episodes appear here after the next feed check.
        </p>
      )}
    </>
  );
}
