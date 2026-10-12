"use client";

import { useActionState, useState, useTransition } from "react";
import { savePreferences } from "@/app/actions/preferences";
import { followPodcast, unfollowPodcast } from "@/app/actions/follows";
import { INTERESTS } from "@/lib/interests";

export type PopularShow = { itunesId: number; title: string; imageUrl: string | null };

/** One tap-to-follow show cover. Following starts summarising its latest episode straight away. */
function ShowTile({
  show,
  podcastId: initialPodcastId,
  onChange,
}: {
  show: PopularShow;
  podcastId: string | null;
  onChange: (followed: boolean) => void;
}) {
  const [podcastId, setPodcastId] = useState(initialPodcastId);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState(false);
  const on = !!podcastId;

  return (
    <button
      type="button"
      disabled={pending}
      aria-pressed={on}
      onClick={() =>
        startTransition(async () => {
          setError(false);
          // "chart": this is our curated list of popular shows.
          const res = on ? await unfollowPodcast(podcastId) : await followPodcast(show.itunesId, "chart");
          if (!res.ok) return setError(true);
          setPodcastId(on ? null : res.podcastId);
          onChange(!on);
        })
      }
      className="group text-left"
    >
      <div className={`relative overflow-hidden rounded-2xl border-2 transition ${on ? "border-accent" : "border-transparent"}`}>
        {show.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- artwork comes from many hosts
          <img src={show.imageUrl} alt="" width={200} height={200} loading="lazy" className={`aspect-square w-full object-cover transition ${pending ? "opacity-50" : ""}`} />
        ) : (
          <div className="grid aspect-square w-full place-items-center bg-accent-soft text-2xl font-semibold text-accent">{show.title[0]}</div>
        )}
        <span
          className={`absolute right-1.5 top-1.5 grid h-7 w-7 place-items-center rounded-full text-sm font-bold shadow ${
            on ? "bg-accent text-white dark:text-black" : "bg-white/90 text-black"
          }`}
          aria-hidden
        >
          {pending ? "…" : on ? "✓" : "+"}
        </span>
      </div>
      <p className="mt-1 line-clamp-2 text-xs leading-snug">{show.title}</p>
      {error && <p className="text-xs text-red-600">Couldn&apos;t follow, try again</p>}
    </button>
  );
}

export function WelcomeForm({
  interests,
  favourites,
  popular,
  followed,
}: {
  interests: string[];
  favourites: string[];
  popular: PopularShow[];
  /** Apple id -> our podcast id for shows already followed. */
  followed: Record<number, string>;
}) {
  const [picked, setPicked] = useState(new Set(interests));
  const [tapped, setTapped] = useState(() => new Set(popular.filter((s) => followed[s.itunesId]).map((s) => s.title)));
  const [state, action, pending] = useActionState(
    async (_prev: { error: string } | void, formData: FormData) => savePreferences(formData),
    undefined,
  );

  function toggle(name: string) {
    const next = new Set(picked);
    if (next.has(name)) next.delete(name);
    else next.add(name);
    setPicked(next);
  }

  // Shows they tapped double as "favourites", which steer Claude's picks.
  const typed = favourites.find((f) => !popular.some((s) => s.title === f)) ?? "";

  return (
    <form action={action} className="space-y-8">
      {popular.length > 0 && (
        <section>
          <h2 className="font-semibold">Tap the shows you listen to</h2>
          <p className="text-sm text-muted">We&apos;ll summarise their latest episode straight away.</p>
          <div className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-4">
            {popular.map((show) => (
              <ShowTile
                key={show.itunesId}
                show={show}
                podcastId={followed[show.itunesId] ?? null}
                onChange={(on) =>
                  setTapped((prev) => {
                    const next = new Set(prev);
                    if (on) next.add(show.title);
                    else next.delete(show.title);
                    return next;
                  })
                }
              />
            ))}
          </div>
          {[...tapped].map((title) => (
            <input key={title} type="hidden" name="favourite" value={title} />
          ))}
        </section>
      )}

      <section>
        <h2 className="font-semibold">Another show you love?</h2>
        <p className="text-sm text-muted">Optional. You can search for any show later.</p>
        <input
          name="favourite"
          defaultValue={typed}
          placeholder="e.g. The Rich Roll Podcast"
          className="mt-3 w-full rounded-xl border border-border bg-surface px-4 py-3 text-base outline-none focus:border-accent"
        />
      </section>

      <section>
        <h2 className="font-semibold">What do you want to get better at?</h2>
        <p className="text-sm text-muted">Pick as many as you like.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {INTERESTS.map(({ name }) => {
            const on = picked.has(name);
            return (
              <label
                key={name}
                className={`cursor-pointer select-none rounded-full border px-3 py-1.5 text-sm transition ${
                  on ? "border-accent bg-accent text-white dark:text-black" : "border-border bg-surface"
                }`}
              >
                <input type="checkbox" name="interest" value={name} checked={on} onChange={() => toggle(name)} className="sr-only" />
                {name}
              </label>
            );
          })}
        </div>
      </section>

      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button
        disabled={pending}
        className="w-full rounded-full bg-accent px-5 py-3 font-medium text-white disabled:opacity-60 dark:text-black"
      >
        {pending ? "Saving…" : tapped.size ? "Next: more shows for you →" : "Show me podcasts →"}
      </button>
    </form>
  );
}
