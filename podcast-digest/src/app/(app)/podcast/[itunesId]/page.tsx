import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { lookupApple } from "@/lib/apple";
import { getFeedEpisodes } from "@/lib/poll";
import { MAX_ATTEMPTS, MAX_EPISODE_MINUTES } from "@/lib/process";
import { getFollowedShows } from "@/lib/follows";
import { PodcastArt } from "@/components/PodcastArt";
import { FollowButton } from "@/components/FollowButton";
import { GetSummaryButton } from "@/components/GetSummaryButton";
import { SummaryProgress, isInProgress } from "@/components/SummaryProgress";
import { AutoRefresh } from "@/components/AutoRefresh";
import { formatDuration, timeAgo } from "@/lib/format";
import type { RecSource } from "@/lib/types";

const SOURCES: RecSource[] = ["claude", "friends", "chart", "search", "link"];

// Following a show or tapping "Get summary" summarises in the background.
export const maxDuration = 300;

/** Episodes shown at first, and how many more each "Show more" adds. */
const PAGE = 20;

type StoredEpisode = {
  id: string;
  guid: string;
  attempts: number;
  title: string;
  published_at: string | null;
  duration_seconds: number | null;
  status: string;
  summaries: { overview: string } | { overview: string }[] | null;
};

/** A show's page: details, every episode with a "Get summary" button, and a sample summary. */
export default async function PodcastPreviewPage({ params, searchParams }: PageProps<"/podcast/[itunesId]">) {
  const itunesId = Number((await params).itunesId);
  if (!Number.isInteger(itunesId) || itunesId <= 0) notFound();
  const query = await searchParams;
  const source = SOURCES.find((s) => s === query.source) ?? "search";
  const shown = Math.min(Math.max(Number(query.n) || PAGE, PAGE), 1000);

  const supabase = await createClient();
  const [[apple], followed, { data: stored }] = await Promise.all([
    lookupApple([itunesId]),
    getFollowedShows(supabase),
    supabase.from("podcasts").select("id, title, author, description, image_url, rss_url").eq("itunes_id", itunesId).maybeSingle(),
  ]);
  if (!apple && !stored) notFound();

  // The full episode list comes from the show's feed; what we've summarised comes from our database.
  const feedUrl = stored?.rss_url ?? apple?.feedUrl;
  const [feed, { data: ourData }] = await Promise.all([
    feedUrl ? getFeedEpisodes(feedUrl).catch(() => []) : Promise.resolve([]),
    stored
      ? supabase
          .from("episodes")
          .select("id, guid, attempts, title, published_at, duration_seconds, status, summaries(overview)")
          .eq("podcast_id", stored.id)
      : Promise.resolve({ data: [] }),
  ]);
  const ours = (ourData ?? []) as unknown as StoredEpisode[];
  const byGuid = new Map(ours.map((e) => [e.guid, e]));
  const sample = ours
    .filter((e) => e.status === "done")
    .sort((a, b) => (b.published_at ?? "").localeCompare(a.published_at ?? ""))
    .map((e) => ({ e, overview: (Array.isArray(e.summaries) ? e.summaries[0] : e.summaries)?.overview }))
    .find((x) => x.overview);
  const episodes = feed.slice(0, shown);
  const anyInProgress = episodes.some((e) => isInProgress(byGuid.get(e.guid)?.status ?? ""));

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

      {stored?.description && <p className="mt-5 line-clamp-3 text-sm leading-relaxed text-muted">{stored.description}</p>}

      {/* A taste of what you get, for shows you don't follow yet. */}
      {sample && !followed.byItunesId[itunesId] && (
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
        <h2 className="text-lg font-semibold">Episodes</h2>
        <p className="mb-3 text-sm text-muted">Tap Get summary on any episode. It takes about a minute.</p>
        <AutoRefresh active={anyInProgress} />
        <ul className="divide-y divide-border rounded-2xl border border-border bg-surface">
          {episodes.map((fe) => {
            const ep = byGuid.get(fe.guid);
            const done = ep?.status === "done";
            const tooLong = (fe.durationSeconds ?? 0) > MAX_EPISODE_MINUTES * 60;
            const gaveUp = ep?.status === "failed" && ep.attempts >= MAX_ATTEMPTS;
            const meta = (
              <p className="mt-0.5 text-xs text-muted">
                {timeAgo(fe.publishedAt)}
                {fe.durationSeconds ? ` · ${formatDuration(fe.durationSeconds)}` : ""}
              </p>
            );
            return (
              <li key={fe.guid} className="p-3">
                {done && ep ? (
                  <Link href={`/episode/${ep.id}`} className="flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-sm font-medium leading-snug">{fe.title}</p>
                      {meta}
                    </div>
                    <span className="shrink-0 rounded-full bg-accent-soft px-3 py-1.5 text-xs font-medium text-accent">Read</span>
                  </Link>
                ) : (
                  <>
                    <div className="flex items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-2 text-sm font-medium leading-snug">{fe.title}</p>
                        {meta}
                      </div>
                      {!ep || !isInProgress(ep.status) ? (
                        <div className="shrink-0">
                          {tooLong ? (
                            <span className="text-xs text-muted">Too long to summarise</span>
                          ) : gaveUp ? (
                            <span className="text-xs text-muted">Couldn&apos;t summarise</span>
                          ) : !fe.audioUrl ? (
                            <span className="text-xs text-muted">No audio</span>
                          ) : (
                            <GetSummaryButton itunesId={itunesId} guid={fe.guid} label={ep?.status === "failed" ? "Try again" : undefined} />
                          )}
                        </div>
                      ) : null}
                    </div>
                    {ep && isInProgress(ep.status) && (
                      <div className="mt-2">
                        <SummaryProgress status={ep.status} />
                      </div>
                    )}
                  </>
                )}
              </li>
            );
          })}
        </ul>
        {!episodes.length && <p className="text-sm text-muted">No episodes found.</p>}
        {feed.length > shown && (
          <Link
            href={`/podcast/${itunesId}?n=${shown + 30}${source !== "search" ? `&source=${source}` : ""}`}
            scroll={false}
            className="mt-3 block rounded-full border border-border bg-surface py-2 text-center text-sm font-medium"
          >
            Show more episodes ({feed.length - shown} older)
          </Link>
        )}
        {!followed.byItunesId[itunesId] && (
          <p className="mt-3 text-xs text-muted">
            Follow to get each new episode summarised automatically. Getting a summary also follows the show.
          </p>
        )}
      </section>
    </article>
  );
}
