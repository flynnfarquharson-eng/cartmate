"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { INTERESTS } from "@/lib/interests";

const VALID = new Set<string>(INTERESTS.map((i) => i.name));

export async function savePreferences(formData: FormData): Promise<{ error: string } | void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Please log in again." };

  const interests = formData.getAll("interest").map(String).filter((i) => VALID.has(i));
  const favouriteShows = formData
    .getAll("favourite")
    .map((f) => String(f).trim().slice(0, 100))
    .filter(Boolean)
    .slice(0, 3);
  if (!interests.length && !favouriteShows.length) {
    return { error: "Pick at least one interest or name a show you love." };
  }

  const { error } = await supabase.from("user_preferences").upsert({
    user_id: user.id,
    interests,
    favourite_shows: favouriteShows,
    updated_at: new Date().toISOString(),
  });
  if (error) return { error: error.message };

  // New tastes, new picks. Keep rows they followed, since those are our measurement.
  await supabase.from("recommendations").delete().eq("source", "claude").is("followed_at", null);

  redirect("/discover");
}
