import Link from "next/link";
import { SaveTipButton } from "@/components/SaveTipButton";
import { Timestamp } from "@/components/Timestamp";
import type { TipRow } from "@/lib/types";

/**
 * One tip. On the episode page its timestamp plays the audio; in the tips
 * library, pass `episode` to show where it came from and link back.
 */
export function TipCard({
  tip,
  saved,
  episode,
}: {
  tip: TipRow;
  saved: boolean;
  episode?: { id: string; title: string; podcastTitle: string };
}) {
  const href = episode ? `/episode/${episode.id}` : undefined;
  return (
    <li className="flex gap-3 rounded-2xl border border-border bg-surface p-3">
      <div className="min-w-0 flex-1">
        <p className="leading-snug">{tip.tip_text}</p>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
          {tip.category && (
            <span className="rounded-full border border-border px-2 py-0.5">{tip.category}</span>
          )}
          {tip.timestamp_seconds != null && <Timestamp seconds={tip.timestamp_seconds} href={href} />}
          {episode && (
            <Link href={href!} className="min-w-0 truncate hover:text-text">
              {episode.podcastTitle} · {episode.title}
            </Link>
          )}
        </div>
      </div>
      <SaveTipButton tipId={tip.id} saved={saved} />
    </li>
  );
}
