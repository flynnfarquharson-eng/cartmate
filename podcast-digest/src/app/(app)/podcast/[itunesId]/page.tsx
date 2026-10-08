import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { lookupApple } from "@/lib/apple";
import { getRecentEpisodesByItunesId, type RecentEpisode } from "@/lib/podcast-index";
import { getFollowedShows } from "@/lib/follows";
import { PodcastArt } from "@/components/PodcastArt";
import { FollowButton } from "@/components/FollowButton";
import { formatDuration, timeAgo } from "@/lib/format";
import type { RecSource } from "@/lib/types";

const SOURCES: RecSource[] = ["claude", "friends", "chart", "search", "link"];

type StoredEpisode = {
  id: string;
  title: string;
  published_at: string | null;
  duration_seconds: number | null;
  status: string;
  summaries: { overview: string } | { overview: string }[] | null;
};

/** Preview a show before following: details, latest episodes, and a sample summary if we have one. */
export default async function PodcastPreviewPage({ params, searchParams }: PageProps<"/podcast/[itunesId]">) {
  const itunesId = Number((await params).itunesId);
  if (!Number.isInteger(itunesId) || itunesId <= 0) notFound();
  const sourceParam = (await searchParams).source;
  const source = SOURCES.find((s) => s === sourceParam) ?? "search";

  const supabase = await createClient();
  const [[apple], followed, { data: stored }] = await Promise.all([
    lookupApple([itunesId]),
    getFollowedShows(supabase),
    supabase.from("podcasts").select("id, title, author, description, image_url").eq("itunes_id", itunesId).maybeSingle(),
  ]);
  if (!apple && !stored) notFound();

  // Shows someone already follows have episodes (and summaries) in our database.
  let ours: StoredEpisode[] = [];
  let theirs: RecentEpisode[] = [];
  if (stored) {
    const { data } = await supabase
      .from("episodes")
      .select("id, title, published_at, duration_seconds, status, summaries(overview)")
      .eq("podcast_id", stored.id)
      .order("published_at", { ascending: false, nullsFirst: false })
      .limit(5);
    ours = (data ?? []) as unknown as StoredEpisode[];
  } else {
    theirs = await getRecentEpisodesByItunesId(itunesId, 5).catch(() => []);
  }
  const sample = ours
    .map((e) => ({ e, overview: (Array.isArray(e.summaries) ? e.summaries[0] : e.summaries)?.overview }))
    .find((x) => x.overview);

  const title = stored?.title ?? apple!.title;
  const author = stored?.author ?? apple?.author ?? "";
  const image = stored?.image_url ?? apple?.imageUrl ?? null;

  return (
    <article>
      <Link href="/discover" className="text-sm text-accent">
        ← Discover
      </Link>

      <header className="mt-4 flex gap-4">
        <PodcastArt src={image} alt={title} size={112} />
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-semibold leading-snug tracking-tight">{title}</h1>
          <p className="text-sm text-muted">{author}</p>
          {apple?.genre && <p className="mt-1 text-xs text-muted">{apple.genre}</p>}
          <div className="mt-3 flex">
            <FollowButton itunesId={itunesId} podcastId={followed.byItunesId[itunesId] ?? null} source={source} />
          </div>
        </div>
      </header>

      {stored?.description && <p className="mt-5 line-clamp-5 text-sm leading-relaxed text-muted">{stored.description}</p>}

      {sample && (
        <section className="mt-8">
          <h2 className="mb-2 text-lg font-semibold">Sample summary</h2>
          <Link
            href={`/episode/${sample.e.id}`}
            className="block rounded-2xl border border-border bg-surface p-4 transition hover:border-accent"
          >
            <p className="text-xs text-muted">{sample.e.title}</p>
            <p className="mt-2 line-clamp-5 text-sm leading-relaxed">{sample.overview}</p>
            <p className="mt-2 text-xs font-medium text-accent">Read the full summary →</p>
          </Link>
        </section>
      )}

      <section className="mt-8">
        <h2 className="mb-3 text-lg font-semibold">Latest episodes</h2>
        <ul className="divide-y divide-border rounded-2xl border border-border bg-surface">
          {(ours.length ? ours : theirs).map((e, i) => {
            const published = "published_at" in e ? e.published_at : e.publishedAt;
            const duration = "duration_seconds" in e ? e.duration_seconds : e.durationSeconds;
            return (
              <li key={i} className="p-3">
                <p className="line-clamp-2 text-sm font-medium leading-snug">{e.title}</p>
                <p className="mt-0.5 text-xs text-muted">
                  {timeAgo(published)}
                  {duration ? ` · ${formatDuration(duration)}` : ""}
                </p>
              </li>
            );
          })}
        </ul>
        {!ours.length && !theirs.length && <p className="text-sm text-muted">No recent episodes found.</p>}
        {!stored && (
          <p className="mt-3 text-xs text-muted">
            Follow to get a summary of each new episode. We summarise the latest 3 straight away.
          </p>
        )}
      </section>
    </article>
  );
}
