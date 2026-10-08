import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { TipCard } from "@/components/TipCard";
import type { TipRow } from "@/lib/types";

export const metadata = { title: "Tips · Podcast Digest" };

type TipWithEpisode = TipRow & {
  episodes: { id: string; title: string; podcasts: { title: string } | null } | null;
};

/** Escape characters that mean "wildcard" in a Postgres ILIKE pattern. */
function likePattern(q: string) {
  return `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

export default async function TipsPage({ searchParams }: PageProps<"/tips">) {
  const params = await searchParams;
  const view = params.view === "all" ? "all" : "saved";
  const q = typeof params.q === "string" ? params.q.trim() : "";
  const category = typeof params.category === "string" ? params.category : "";

  const supabase = await createClient();
  const [{ data: follows }, { data: savedRows }] = await Promise.all([
    supabase.from("user_follows").select("podcast_id"),
    supabase.from("saved_tips").select("tip_id"),
  ]);
  const followed = (follows ?? []).map((f) => f.podcast_id as string);
  const saved = new Set((savedRows ?? []).map((s) => s.tip_id as string));

  let tips: TipWithEpisode[] = [];
  const canQuery = view === "saved" ? saved.size > 0 : followed.length > 0;
  if (canQuery) {
    let query = supabase
      .from("tips")
      .select("id, tip_text, category, timestamp_seconds, episodes!inner(id, title, podcast_id, podcasts(title))")
      .order("created_at", { ascending: false })
      .limit(300);
    query = view === "saved" ? query.in("id", [...saved]) : query.in("episodes.podcast_id", followed);
    if (q) query = query.ilike("tip_text", likePattern(q));
    const { data } = await query;
    tips = (data ?? []) as unknown as TipWithEpisode[];
  }

  // Category chips come from the tips matching the current search.
  const counts = new Map<string, number>();
  for (const t of tips) if (t.category) counts.set(t.category, (counts.get(t.category) ?? 0) + 1);
  const categories = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12);
  const shown = category ? tips.filter((t) => t.category === category) : tips;

  const href = (next: Record<string, string>) => {
    const merged = { view, q, category, ...next };
    const qs = new URLSearchParams(Object.entries(merged).filter(([, v]) => v));
    return `/tips?${qs}`;
  };

  return (
    <>
      <h1 className="mb-4 text-2xl font-semibold tracking-tight">Tips</h1>

      <div className="mb-3 inline-flex rounded-full border border-border bg-surface p-1 text-sm">
        {(["saved", "all"] as const).map((v) => (
          <Link
            key={v}
            href={href({ view: v, category: "" })}
            className={`rounded-full px-4 py-1.5 ${view === v ? "bg-accent text-white dark:text-black" : "text-muted"}`}
          >
            {v === "saved" ? `Saved (${saved.size})` : "All tips"}
          </Link>
        ))}
      </div>

      <form action="/tips" className="mb-3">
        <input type="hidden" name="view" value={view} />
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Search tips, e.g. sleep, pricing, hiring"
          className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-base outline-none focus:border-accent"
        />
      </form>

      {categories.length > 1 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {categories.map(([name, count]) => (
            <Link
              key={name}
              href={href({ category: category === name ? "" : name })}
              className={`rounded-full border px-3 py-1 text-xs ${
                category === name ? "border-accent bg-accent-soft text-accent" : "border-border text-muted"
              }`}
            >
              {name} <span className="opacity-60">{count}</span>
            </Link>
          ))}
        </div>
      )}

      {shown.length ? (
        <ul className="space-y-2">
          {shown.map((t) => (
            <TipCard
              key={t.id}
              tip={t}
              saved={saved.has(t.id)}
              episode={
                t.episodes
                  ? { id: t.episodes.id, title: t.episodes.title, podcastTitle: t.episodes.podcasts?.title ?? "" }
                  : undefined
              }
            />
          ))}
        </ul>
      ) : (
        <div className="mt-12 text-center text-sm text-muted">
          {q || category ? (
            <p>No tips match that search.</p>
          ) : view === "saved" ? (
            <>
              <p>You haven&apos;t saved any tips yet.</p>
              <Link href={href({ view: "all" })} className="mt-2 inline-block text-accent">
                Browse all tips →
              </Link>
            </>
          ) : (
            <p>Tips appear here once episodes from your shows are summarised.</p>
          )}
        </div>
      )}
    </>
  );
}
