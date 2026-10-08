import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { recommendShows } from "@/lib/recommend";
import { topChart } from "@/lib/apple";
import { genreFor } from "@/lib/interests";
import { ShowShelf, ShowTile } from "@/components/ShowCard";
import type { FollowedShows } from "@/lib/follows";
import type { RecSource, ShowSummary } from "@/lib/types";

type Supabase = Awaited<ReturnType<typeof createClient>>;
export type Preferences = { interests: string[]; favourite_shows: string[]; updated_at: string };

/** Record what we showed, so the admin stats can compare follow rates by source. */
async function logShown(supabase: Supabase, userId: string, source: RecSource, shows: ShowSummary[]) {
  if (!shows.length) return;
  await supabase.from("recommendations").upsert(
    shows.map((s, i) => ({
      user_id: userId,
      itunes_id: s.itunesId,
      source,
      title: s.title,
      author: s.author,
      image_url: s.imageUrl,
      reason: s.reason ?? null,
      position: i,
    })),
    { onConflict: "user_id,itunes_id,source", ignoreDuplicates: true },
  );
}

/** Claude's picks. Generated once per set of preferences, then read from the database. */
export async function PickedForYou({
  userId,
  prefs,
  followed,
}: {
  userId: string;
  prefs: Preferences;
  followed: FollowedShows;
}) {
  const supabase = await createClient();
  const { data: cached } = await supabase
    .from("recommendations")
    .select("itunes_id, title, author, image_url, reason")
    .eq("source", "claude")
    .gte("shown_at", prefs.updated_at)
    .order("position");

  let shows: ShowSummary[] = (cached ?? []).map((r) => ({
    itunesId: r.itunes_id,
    title: r.title,
    author: r.author ?? "",
    imageUrl: r.image_url,
    reason: r.reason,
  }));

  if (!shows.length) {
    try {
      const recs = await recommendShows({
        interests: prefs.interests,
        favouriteShows: prefs.favourite_shows,
        alreadyFollowing: followed.titles,
        excludeItunesIds: new Set(Object.keys(followed.byItunesId).map(Number)),
      });
      shows = recs.map((r) => ({ itunesId: r.itunesId, title: r.title, author: r.author, imageUrl: r.imageUrl, reason: r.reason }));
      await logShown(supabase, userId, "claude", shows);
    } catch (err) {
      console.error("[discover] recommendations failed:", err);
    }
  }

  if (!shows.length) return null;
  return (
    <ShowShelf title="Picked for you" subtitle="Based on what you're into. Every show checked to be real and still running.">
      {shows.map((s) => (
        <ShowTile key={s.itunesId} show={s} source="claude" podcastId={followed.byItunesId[s.itunesId] ?? null} />
      ))}
    </ShowShelf>
  );
}

/** Shows other people on Podcast Digest follow. They're already summarised, so free to add. */
export async function PopularWithFriends({ userId, followed }: { userId: string; followed: FollowedShows }) {
  // Counting across everyone needs the admin client (each user can only see their own follows).
  // Only show names and counts leave this function, never who follows what.
  const admin = createAdminClient();
  const { data } = await admin.from("user_follows").select("user_id, podcasts(itunes_id, title, author, image_url)");

  const counts = new Map<number, { show: ShowSummary; count: number }>();
  for (const row of data ?? []) {
    if (row.user_id === userId) continue;
    const p = row.podcasts as unknown as { itunes_id: number | null; title: string; author: string | null; image_url: string | null } | null;
    if (!p?.itunes_id || followed.byItunesId[p.itunes_id]) continue;
    const entry = counts.get(p.itunes_id) ?? {
      show: { itunesId: p.itunes_id, title: p.title, author: p.author ?? "", imageUrl: p.image_url },
      count: 0,
    };
    entry.count++;
    counts.set(p.itunes_id, entry);
  }
  const top = [...counts.values()].sort((a, b) => b.count - a.count).slice(0, 12);
  if (!top.length) return null;

  const supabase = await createClient();
  await logShown(supabase, userId, "friends", top.map((t) => t.show));
  return (
    <ShowShelf title="Popular with friends" subtitle="Already summarised, so new episodes are ready to read.">
      {top.map(({ show, count }) => (
        <ShowTile
          key={show.itunesId}
          show={show}
          source="friends"
          podcastId={null}
          note={`${count} ${count === 1 ? "person follows" : "people follow"}`}
        />
      ))}
    </ShowShelf>
  );
}

/** Apple's Australian top chart for one interest (or overall when interest is null). */
export async function TopChart({
  userId,
  interest,
  followed,
}: {
  userId: string;
  interest: string | null;
  followed: FollowedShows;
}) {
  const genreId = interest ? genreFor(interest) : null;
  if (interest && !genreId) return null;
  let shows: ShowSummary[] = [];
  try {
    shows = await topChart(genreId, 15);
  } catch (err) {
    console.error("[discover] chart failed:", err);
  }
  if (!shows.length) return null;

  const supabase = await createClient();
  await logShown(supabase, userId, "chart", shows);
  return (
    <ShowShelf title={interest ? `Top in Australia: ${interest}` : "Top podcasts in Australia"}>
      {shows.map((s) => (
        <ShowTile key={s.itunesId} show={s} source="chart" podcastId={followed.byItunesId[s.itunesId] ?? null} />
      ))}
    </ShowShelf>
  );
}

export function ShelfSkeleton({ title }: { title: string }) {
  return (
    <section className="mt-8" aria-busy>
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="text-sm text-muted">Finding shows for you…</p>
      <ul className="-mx-4 mt-3 flex gap-4 overflow-hidden px-4">
        {Array.from({ length: 4 }, (_, i) => (
          <li key={i} className="w-36 shrink-0">
            <div className="h-36 w-36 animate-pulse rounded-xl bg-border" />
            <div className="mt-2 h-3 w-28 animate-pulse rounded bg-border" />
            <div className="mt-1 h-3 w-20 animate-pulse rounded bg-border" />
          </li>
        ))}
      </ul>
    </section>
  );
}
