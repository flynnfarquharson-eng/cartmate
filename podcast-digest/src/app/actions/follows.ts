"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPodcastById } from "@/lib/podcast-index";
import { pollPodcastById } from "@/lib/poll";

type ActionResult = { ok: true; podcastId: string } | { ok: false; error: string };

export async function followPodcast(podcastIndexId: number): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Please log in again." };

  // Look the show up ourselves rather than trusting data sent from the browser.
  const show = await getPodcastById(podcastIndexId);
  if (!show || !show.rssUrl) return { ok: false, error: "Couldn't find that podcast." };

  // One shared row per show, no matter how many people follow it.
  const admin = createAdminClient();
  const { data: podcast, error } = await admin
    .from("podcasts")
    .upsert(
      {
        podcast_index_id: show.podcastIndexId,
        title: show.title,
        author: show.author,
        description: show.description,
        image_url: show.imageUrl,
        rss_url: show.rssUrl,
        website_url: show.websiteUrl,
      },
      { onConflict: "podcast_index_id" },
    )
    .select("id, import_after")
    .single();
  if (error || !podcast) return { ok: false, error: error?.message ?? "Couldn't save podcast." };

  const { error: followError } = await supabase
    .from("user_follows")
    .upsert({ user_id: user.id, podcast_id: podcast.id }, { onConflict: "user_id,podcast_id" });
  if (followError) return { ok: false, error: followError.message };

  // First time anyone has followed this show: grab its latest episodes right away.
  if (!podcast.import_after) {
    await pollPodcastById(podcast.id);
  }

  revalidatePath("/settings");
  revalidatePath("/feed");
  return { ok: true, podcastId: podcast.id };
}

export async function unfollowPodcast(podcastId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Please log in again." };

  const { error } = await supabase
    .from("user_follows")
    .delete()
    .eq("user_id", user.id)
    .eq("podcast_id", podcastId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/settings");
  revalidatePath("/feed");
  return { ok: true, podcastId };
}
