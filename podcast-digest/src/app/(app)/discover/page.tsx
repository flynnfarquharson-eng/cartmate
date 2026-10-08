import Link from "next/link";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { getFollowedShows } from "@/lib/follows";
import { SearchClient } from "@/components/SearchClient";
import { PickedForYou, PopularWithFriends, ShelfSkeleton, TopChart, type Preferences } from "./sections";

export const metadata = { title: "Discover · Podcast Digest" };
// "Picked for you" can take ~15 seconds the first time (Claude + checking each show).
export const maxDuration = 60;

export default async function DiscoverPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const [followed, { data: prefsData }] = await Promise.all([
    getFollowedShows(supabase),
    supabase.from("user_preferences").select("interests, favourite_shows, updated_at").maybeSingle(),
  ]);
  const prefs = prefsData as Preferences | null;
  const userId = user!.id; // the proxy only lets logged-in users reach this page
  // Up to 3 interest charts; with no interests, the overall Australian chart.
  const chartInterests = prefs?.interests.length ? prefs.interests.slice(0, 3) : [null];

  return (
    <>
      <h1 className="mb-4 text-2xl font-semibold tracking-tight">Discover</h1>
      <SearchClient followed={followed.byItunesId} />

      {prefs ? (
        <p className="mt-4 text-sm text-muted">
          Into {prefs.interests.join(", ").toLowerCase() || "a bit of everything"}.{" "}
          <Link href="/welcome" className="text-accent">
            Change
          </Link>
        </p>
      ) : (
        <Link
          href="/welcome"
          className="mt-6 block rounded-2xl border border-accent bg-accent-soft p-4 text-accent"
        >
          <p className="font-semibold">Get picks made for you →</p>
          <p className="text-sm opacity-80">Tell us what you&apos;re into and the shows you love. Takes 20 seconds.</p>
        </Link>
      )}

      {prefs && (
        <Suspense fallback={<ShelfSkeleton title="Picked for you" />}>
          <PickedForYou userId={userId} prefs={prefs} followed={followed} />
        </Suspense>
      )}
      <Suspense fallback={null}>
        <PopularWithFriends userId={userId} followed={followed} />
      </Suspense>
      {chartInterests.map((interest) => (
        <Suspense key={interest ?? "all"} fallback={<ShelfSkeleton title={interest ? `Top in Australia: ${interest}` : "Top podcasts in Australia"} />}>
          <TopChart userId={userId} interest={interest} followed={followed} />
        </Suspense>
      ))}
    </>
  );
}
