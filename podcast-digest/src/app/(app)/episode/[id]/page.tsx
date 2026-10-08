import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PodcastArt } from "@/components/PodcastArt";
import { StatusBadge } from "@/components/StatusBadge";
import { TipCard } from "@/components/TipCard";
import { EpisodeAudio, Timestamp } from "@/components/Timestamp";
import { formatDuration, timeAgo } from "@/lib/format";
import type { KeyIdea, Quote, Resource, TipRow } from "@/lib/types";

type EpisodeRow = {
  id: string;
  title: string;
  description: string | null;
  published_at: string | null;
  duration_seconds: number | null;
  audio_url: string | null;
  episode_url: string | null;
  status: string;
  podcasts: { title: string; image_url: string | null } | null;
};

type SummaryRow = {
  overview: string;
  key_ideas: KeyIdea[];
  quotes_with_timestamps: Quote[];
  resources_mentioned: Resource[];
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="mb-3 text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}

export default async function EpisodePage({ params, searchParams }: PageProps<"/episode/[id]">) {
  const { id } = await params;
  const t = Number((await searchParams).t);
  const supabase = await createClient();

  const [{ data: episodeData }, { data: summaryData }, { data: tipsData }, { data: savedData }] =
    await Promise.all([
      supabase
        .from("episodes")
        .select("id, title, description, published_at, duration_seconds, audio_url, episode_url, status, podcasts(title, image_url)")
        .eq("id", id)
        .maybeSingle(),
      supabase
        .from("summaries")
        .select("overview, key_ideas, quotes_with_timestamps, resources_mentioned")
        .eq("episode_id", id)
        .maybeSingle(),
      supabase
        .from("tips")
        .select("id, tip_text, category, timestamp_seconds")
        .eq("episode_id", id)
        .order("timestamp_seconds", { ascending: true, nullsFirst: false }),
      supabase.from("saved_tips").select("tip_id"),
    ]);

  const episode = episodeData as unknown as EpisodeRow | null;
  if (!episode) notFound();
  const summary = summaryData as SummaryRow | null;
  const tips = (tipsData ?? []) as TipRow[];
  const saved = new Set((savedData ?? []).map((s) => s.tip_id as string));

  return (
    <article>
      <Link href="/feed" className="text-sm text-accent">
        ← Feed
      </Link>

      <header className="mt-4 flex gap-4">
        <PodcastArt src={episode.podcasts?.image_url} alt={episode.podcasts?.title ?? ""} size={80} />
        <div className="min-w-0">
          <p className="text-sm text-muted">{episode.podcasts?.title}</p>
          <h1 className="text-xl font-semibold leading-snug tracking-tight">{episode.title}</h1>
          <p className="mt-1 text-xs text-muted">
            {timeAgo(episode.published_at)}
            {episode.duration_seconds ? ` · ${formatDuration(episode.duration_seconds)}` : ""}
            {episode.episode_url && (
              <>
                {" · "}
                <a href={episode.episode_url} target="_blank" rel="noreferrer" className="text-accent">
                  Original episode
                </a>
              </>
            )}
          </p>
        </div>
      </header>

      {episode.audio_url && (
        <div className="mt-5">
          <EpisodeAudio src={episode.audio_url} startAt={Number.isFinite(t) && t > 0 ? t : undefined} />
        </div>
      )}

      {!summary ? (
        <div className="mt-8 rounded-2xl border border-border bg-surface p-5 text-center">
          <StatusBadge status={episode.status} />
          <p className="mt-2 text-sm text-muted">
            {episode.status === "failed"
              ? "We couldn't summarise this episode."
              : "The summary isn't ready yet. Check back soon."}
          </p>
        </div>
      ) : (
        <>
          <Section title="Overview">
            <p className="leading-relaxed">{summary.overview}</p>
          </Section>

          {summary.key_ideas.length > 0 && (
            <Section title="Key ideas">
              <ol className="space-y-3">
                {summary.key_ideas.map((idea, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-accent-soft text-xs font-semibold text-accent">
                      {i + 1}
                    </span>
                    <div>
                      <p className="font-medium">{idea.title}</p>
                      <p className="text-sm leading-relaxed text-muted">{idea.detail}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </Section>
          )}

          {tips.length > 0 && (
            <Section title={`Tips (${tips.length})`}>
              <ul className="space-y-2">
                {tips.map((tip) => (
                  <TipCard key={tip.id} tip={tip} saved={saved.has(tip.id)} />
                ))}
              </ul>
            </Section>
          )}

          {summary.quotes_with_timestamps.length > 0 && (
            <Section title="Quotes">
              <ul className="space-y-4">
                {summary.quotes_with_timestamps.map((q, i) => (
                  <li key={i} className="border-l-2 border-accent pl-4">
                    <p className="italic leading-relaxed">“{q.quote}”</p>
                    <div className="mt-1 flex items-center gap-2 text-xs text-muted">
                      {q.speaker && <span>{q.speaker}</span>}
                      {q.timestamp_seconds != null && <Timestamp seconds={q.timestamp_seconds} />}
                    </div>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {summary.resources_mentioned.length > 0 && (
            <Section title="Mentioned">
              <ul className="flex flex-wrap gap-2">
                {summary.resources_mentioned.map((r, i) => {
                  const label = (
                    <>
                      {r.name} <span className="text-muted">· {r.type}</span>
                    </>
                  );
                  return (
                    <li key={i} className="rounded-full border border-border bg-surface px-3 py-1 text-sm">
                      {r.url ? (
                        <a href={r.url} target="_blank" rel="noreferrer" className="hover:text-accent">
                          {label}
                        </a>
                      ) : (
                        label
                      )}
                    </li>
                  );
                })}
              </ul>
            </Section>
          )}
        </>
      )}
    </article>
  );
}
