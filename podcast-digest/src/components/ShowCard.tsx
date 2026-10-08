import Link from "next/link";
import { PodcastArt } from "@/components/PodcastArt";
import { FollowButton } from "@/components/FollowButton";
import type { RecSource, ShowSummary } from "@/lib/types";

function previewHref(show: ShowSummary, source: RecSource) {
  return `/podcast/${show.itunesId}?source=${source}`;
}

/** A square tile for horizontal rows (recommendations, charts, friends). */
export function ShowTile({
  show,
  source,
  podcastId,
  note,
}: {
  show: ShowSummary;
  source: RecSource;
  podcastId: string | null;
  /** Small grey line under the author, e.g. "3 friends follow". */
  note?: string;
}) {
  return (
    <li className="flex w-36 shrink-0 snap-start flex-col">
      <Link href={previewHref(show, source)} className="group">
        <PodcastArt src={show.imageUrl} alt={show.title} size={144} />
        <p className="mt-2 line-clamp-2 text-sm font-medium leading-snug group-hover:text-accent">{show.title}</p>
        <p className="truncate text-xs text-muted">{show.author}</p>
        {note && <p className="truncate text-xs text-accent">{note}</p>}
        {show.reason && <p className="mt-1 line-clamp-3 text-xs leading-snug text-muted">{show.reason}</p>}
      </Link>
      <div className="mt-2 flex">
        <FollowButton itunesId={show.itunesId} podcastId={podcastId} source={source} size="sm" />
      </div>
    </li>
  );
}

/** A full-width row for search results. */
export function ShowRow({
  show,
  source,
  podcastId,
}: {
  show: ShowSummary;
  source: RecSource;
  podcastId: string | null;
}) {
  return (
    <li className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-3">
      <Link href={previewHref(show, source)} className="flex min-w-0 flex-1 items-center gap-3">
        <PodcastArt src={show.imageUrl} alt={show.title} />
        <div className="min-w-0">
          <p className="truncate font-medium">{show.title}</p>
          <p className="truncate text-sm text-muted">{show.author}</p>
        </div>
      </Link>
      <FollowButton itunesId={show.itunesId} podcastId={podcastId} source={source} />
    </li>
  );
}

/** A titled, horizontally scrolling row of tiles. */
export function ShowShelf({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-lg font-semibold">{title}</h2>
      {subtitle && <p className="text-sm text-muted">{subtitle}</p>}
      <ul className="-mx-4 mt-3 flex snap-x gap-4 overflow-x-auto px-4 pb-2">{children}</ul>
    </section>
  );
}
