import Link from "next/link";
import { LoginForm } from "@/components/LoginForm";
import { PodcastArt } from "@/components/PodcastArt";
import { AppStoreTeaser } from "@/components/AppStoreTeaser";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPopularShows, shortTitle } from "@/lib/popular";

/** The example on the landing page: Founders on Sam Walton, whose tips suit anyone in business. */
const SAMPLE_EPISODE_ID = "59d2d762-ec89-4e2f-aafe-0ac7a0da548c";

type Sample = {
  title: string;
  podcastTitle: string;
  imageUrl: string | null;
  overview: string;
  tips: string[];
};

/** An example of what's in the email. */
async function getSample(): Promise<Sample | null> {
  try {
    const db = createAdminClient();
    const columns = "title, podcasts(title, image_url), summaries(overview), tips(tip_text)";
    let { data } = await db.from("episodes").select(columns).eq("id", SAMPLE_EPISODE_ID).eq("status", "done").maybeSingle();
    // If the pinned episode is ever gone, fall back to the latest summary.
    if (!data) {
      ({ data } = await db.from("episodes").select(columns).eq("status", "done").order("processed_at", { ascending: false }).limit(1).maybeSingle());
    }
    if (!data) return null;
    const podcast = data.podcasts as unknown as { title: string; image_url: string | null } | null;
    const summaryRaw = data.summaries as unknown as { overview: string } | { overview: string }[] | null;
    const overview = (Array.isArray(summaryRaw) ? summaryRaw[0] : summaryRaw)?.overview;
    if (!overview) return null;
    const firstSentences = overview.split(/(?<=\.)\s+/).slice(0, 2).join(" ");
    return {
      title: data.title,
      podcastTitle: podcast?.title ?? "",
      imageUrl: podcast?.image_url ?? null,
      overview: firstSentences,
      // The shortest tips read best in a preview.
      tips: ((data.tips as unknown as { tip_text: string }[]) ?? [])
        .map((t) => t.tip_text)
        .sort((a, b) => a.length - b.length)
        .slice(0, 3),
    };
  } catch {
    return null; // the page still works without a sample
  }
}

export default async function Landing({ searchParams }: PageProps<"/">) {
  const params = await searchParams;
  const next = typeof params.next === "string" ? params.next : undefined;
  const linkError = params.error === "link";
  const [sample, popular] = await Promise.all([getSample(), getPopularShows()]);

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-12">
      <div className="mb-8">
        <div className="mb-8 flex items-center gap-2.5">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-accent text-lg text-white dark:text-black" aria-hidden>
            ◉
          </div>
          <span className="text-xl font-semibold tracking-tight">Podie</span>
        </div>
        <h1 className="text-3xl font-semibold leading-tight tracking-tight">Remember what you learn from podcasts.</h1>
        <p className="mt-3 text-muted">
          The key ideas and best tips from the business and self-improvement shows you love, in a 3-minute email every
          Sunday. Tap any tip to hear the exact moment it was said.
        </p>
        {popular.length > 0 && (
          <div className="mt-5 flex items-center gap-3">
            <div className="flex shrink-0 -space-x-2.5">
              {popular.slice(0, 5).map((show) => (
                // eslint-disable-next-line @next/next/no-img-element -- artwork comes from many hosts
                <img
                  key={show.itunesId}
                  src={show.imageUrl ?? ""}
                  alt={shortTitle(show.title)}
                  title={shortTitle(show.title)}
                  width={40}
                  height={40}
                  className="h-10 w-10 shrink-0 rounded-lg border-2 border-bg object-cover"
                />
              ))}
            </div>
            <p className="min-w-0 text-xs leading-snug text-muted">
              {popular.slice(0, 2).map((s) => shortTitle(s.title)).join(", ")}
              <br />
              and almost any other show
            </p>
          </div>
        )}
      </div>

      {linkError && (
        <p className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          That link didn&apos;t work (they expire and only work once). Please request a new one.
        </p>
      )}

      <LoginForm next={next} cta="Get the Sunday digest, free" />
      <p className="mt-3 text-xs leading-relaxed text-muted">
        By signing up you agree to get the weekly digest email. Unsubscribe any time with one click.{" "}
        <Link href="/privacy" className="underline">
          Privacy
        </Link>
        . Already signed up? Enter your email to log in.
      </p>

      <AppStoreTeaser />

      {sample && (
        <section className="mt-10">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">What you get, for every episode</p>
          <div className="rounded-2xl border border-border bg-surface p-4">
            <div className="flex gap-3">
              <PodcastArt src={sample.imageUrl} alt={sample.podcastTitle} size={44} />
              <div className="min-w-0">
                <p className="truncate text-xs text-muted">{sample.podcastTitle}</p>
                <p className="line-clamp-2 text-sm font-medium leading-snug">{sample.title}</p>
              </div>
            </div>
            <p className="mt-3 text-sm leading-relaxed">{sample.overview}</p>
            {sample.tips.length > 0 && (
              <>
                <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-accent">Top tips</p>
                <ul className="mt-1 list-disc space-y-1 pl-4 text-sm leading-snug">
                  {sample.tips.map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </section>
      )}

      <ul className="mt-8 space-y-3 text-sm">
        {[
          ["Keep what you learn", "Save the best tips to your library and find them again in seconds."],
          ["Hear the moment", "Tap any tip or quote to play that exact part of the episode."],
          ["Catch up on anything", "Get any past episode summarised in about a minute."],
        ].map(([title, text]) => (
          <li key={title} className="flex gap-3">
            <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-accent-soft text-[11px] font-bold text-accent" aria-hidden>
              ✓
            </span>
            <span>
              <span className="font-medium">{title}.</span> <span className="text-muted">{text}</span>
            </span>
          </li>
        ))}
      </ul>
    </main>
  );
}
