import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PodcastArt } from "@/components/PodcastArt";
import { SummaryProgress, isInProgress } from "@/components/SummaryProgress";
import { AutoRefresh } from "@/components/AutoRefresh";
import { formatDuration, timeAgo } from "@/lib/format";

export const metadata = { title: "Library · Podcast Digest" };

/** Summaries listed per show before "See all". */
const PER_SHOW = 5;

type Row = {
  id: string;
  title: string;
  published_at: string | null;
  duration_seconds: number | null;
  status: string;
  podcast_id: string;
  tips: { count: number }[];
};

type Show = { id: string; title: string; image_url: string | null; itunes_id: number | null };

/** Every summary you have, grouped by show, with anything still being made at the top. */
export default async function LibraryPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const { data: follows } = await supabase
    .from("user_follows")
    .select("podcasts(id, title, image_url, itunes_id)")
    .order("created_at", { ascending: false });
  const shows = (follows ?? []).map((f) => f.podcasts as unknown as Show).filter(Boolean);
  if (!shows.length) {
    return (
      <div className="mt-16 text-center">
        <h1 className="text-xl font-semibold">Your library is empty</h1>
        <p className="mt-2 text-muted">Follow a podcast, then tap Get summary on any episode.</p>
        <Link href="/discover" className="mt-6 inline-block rounded-full bg-accent px-5 py-2.5 font-medium text-white dark:text-black">
          Find podcasts
        </Link>
      </div>
    );
  }

  const { data } = await supabase
    .from("episodes")
    .select("id, title, published_at, duration_seconds, status, podcast_id, tips(count)")
    .in("podcast_id", shows.map((s) => s.id))
    .in("status", ["done", "transcribing", "summarising"])
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(500);
  const episodes = (data ?? []) as unknown as Row[];
  const working = episodes.filter((e) => isInProgress(e.status));
  const showById = new Map(shows.map((s) => [s.id, s]));

  // Shows with summaries first (most recent episode first), then the rest.
  const grouped = shows
    .map((show) => ({ show, done: episodes.filter((e) => e.podcast_id === show.id && e.status === "done") }))
    .sort((a, b) => (b.done[0]?.published_at ?? "").localeCompare(a.done[0]?.published_at ?? ""));
  const total = grouped.reduce((n, g) => n + g.done.length, 0);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Library</h1>
        <p className="text-sm text-muted">
          {total} {total === 1 ? "summary" : "summaries"} from {shows.length} {shows.length === 1 ? "show" : "shows"}
        </p>
      </div>

      <AutoRefresh active={working.length > 0} />
      {working.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">Getting ready</h2>
          <ul className="space-y-2">
            {working.map((e) => (
              <li key={e.id} className="rounded-2xl border border-border bg-surface p-3">
                <p className="truncate text-xs text-muted">{showById.get(e.podcast_id)?.title}</p>
                <p className="line-clamp-2 text-sm font-medium leading-snug">{e.title}</p>
                <div className="mt-2">
                  <SummaryProgress status={e.status} />
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {grouped.map(({ show, done }) => {
        const showHref = show.itunes_id ? `/podcast/${show.itunes_id}` : null;
        return (
          <section key={show.id}>
            <div className="mb-2 flex items-center gap-3">
              <PodcastArt src={show.image_url} alt={show.title} size={40} />
              <div className="min-w-0 flex-1">
                <h2 className="truncate font-semibold leading-tight">{show.title}</h2>
                <p className="text-xs text-muted">
                  {done.length} {done.length === 1 ? "summary" : "summaries"}
                </p>
              </div>
              {showHref && (
                <Link href={showHref} className="shrink-0 rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-medium">
                  All episodes
                </Link>
              )}
            </div>
            {done.length ? (
              <ul className="divide-y divide-border rounded-2xl border border-border bg-surface">
                {done.slice(0, PER_SHOW).map((e) => {
                  const tipCount = e.tips?.[0]?.count ?? 0;
                  return (
                    <li key={e.id}>
                      <Link href={`/episode/${e.id}`} className="flex items-center gap-3 p-3 hover:text-accent">
                        <div className="min-w-0 flex-1">
                          <p className="line-clamp-2 text-sm font-medium leading-snug">{e.title}</p>
                          <p className="mt-0.5 text-xs text-muted">
                            {timeAgo(e.published_at)}
                            {e.duration_seconds ? ` · ${formatDuration(e.duration_seconds)}` : ""}
                            {tipCount ? ` · ${tipCount} tips` : ""}
                          </p>
                        </div>
                        <span className="shrink-0 text-muted" aria-hidden>
                          ›
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="rounded-2xl border border-dashed border-border p-3 text-sm text-muted">
                No summaries yet. {showHref ? "Tap All episodes to pick one." : "New episodes will appear here."}
              </p>
            )}
            {done.length > PER_SHOW && showHref && (
              <Link href={showHref} className="mt-2 block text-center text-xs font-medium text-accent">
                See all {done.length} summaries
              </Link>
            )}
          </section>
        );
      })}
    </div>
  );
}
