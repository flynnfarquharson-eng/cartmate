import { createClient } from "@/lib/supabase/server";
import { WelcomeForm } from "@/components/WelcomeForm";

export const metadata = { title: "Welcome · Podcast Digest" };

export default async function WelcomePage() {
  const supabase = await createClient();
  const { data } = await supabase.from("user_preferences").select("interests, favourite_shows").maybeSingle();

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">{data ? "Your interests" : "Welcome to Podcast Digest"}</h1>
      <p className="mb-6 mt-1 text-muted">
        Tell us what you like and we&apos;ll suggest shows to follow. You&apos;ll get a short summary of every new episode.
      </p>
      <WelcomeForm interests={data?.interests ?? []} favourites={data?.favourite_shows ?? []} />
    </>
  );
}
