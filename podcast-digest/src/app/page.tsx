import Link from "next/link";
import { LoginForm } from "@/components/LoginForm";
import { PodcastArt } from "@/components/PodcastArt";
import { createAdminClient } from "@/lib/supabase/admin";

type Sample = {
  title: string;
  podcastTitle: string;
  imageUrl: string | null;
  overview: string;
  tips: string[];
};

/** The latest summarised episode, shown as an example of what's in the email. */
async function getSample(): Promise<Sample | null> {
  try {
    const { data } = await createAdminClient()
      .from("episodes")
      .select("title, podcasts(title, image_url), summaries(overview), tips(tip_text)")
      .eq("status", "done")
      .order("processed_at", { ascending: false })
      .limit(1)
      .maybeSingle();
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
      tips: ((data.tips as unknown as { tip_text: string }[]) ?? []).slice(0, 2).map((t) => t.tip_text),
    };
  } catch {
    return null; // the page still works without a sample
  }
}

export default async function Landing({ searchParams }: PageProps<"/">) {
  const params = await searchParams;
  const next = typeof params.next === "string" ? params.next : undefined;
  const linkError = params.error === "link";
  const sample = await getSample();

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-12">
      <div className="mb-8">
        <div className="mb-6 grid h-12 w-12 place-items-center rounded-2xl bg-accent text-2xl text-white dark:text-black">
          ◉
        </div>
        <h1 className="text-3xl font-semibold leading-tight tracking-tight">
          Your favourite podcasts, summarised. Every Sunday.
        </h1>
        <p className="mt-3 text-muted">
          Pick the shows you love. Every Sunday morning you&apos;ll get a 3-minute email with the key
          ideas and best tips from each new episode, with links to listen to the moments that matter.
        </p>
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

      {sample && (
        <section className="mt-10">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">From a recent digest</p>
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

      <ul className="mt-8 space-y-2 text-sm text-muted">
        <li>• Works with almost any podcast, including Australian shows</li>
        <li>• Tell us what you&apos;re into and we&apos;ll suggest shows</li>
        <li>• Prefer an app? Read every summary and save tips at any time</li>
      </ul>
    </main>
  );
}
