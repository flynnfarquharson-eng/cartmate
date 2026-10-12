import { createClient } from "@/lib/supabase/server";
import { WelcomeForm } from "@/components/WelcomeForm";
import { getFollowedShows } from "@/lib/follows";
import { getPopularShows, shortTitle } from "@/lib/popular";

export const metadata = { title: "Welcome · Podie" };
// Tapping a show follows it and summarises its latest episode in the background.
export const maxDuration = 300;

export default async function WelcomePage() {
  const supabase = await createClient();
  const [{ data }, followed, popular] = await Promise.all([
    supabase.from("user_preferences").select("interests, favourite_shows").maybeSingle(),
    getFollowedShows(supabase),
    getPopularShows(),
  ]);

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">{data ? "Your shows and interests" : "Welcome to Podie"}</h1>
      <p className="mb-6 mt-1 text-muted">
        Pick the podcasts you listen to. Every new episode becomes a 3-minute summary with the key ideas and tips worth
        keeping.
      </p>
      <WelcomeForm
        interests={data?.interests ?? []}
        favourites={data?.favourite_shows ?? []}
        popular={popular.map((s) => ({ itunesId: s.itunesId, title: shortTitle(s.title), imageUrl: s.imageUrl }))}
        followed={followed.byItunesId}
      />
    </>
  );
}
