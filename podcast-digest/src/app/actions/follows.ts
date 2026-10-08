"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPodcastByFeedUrl, getPodcastByItunesId } from "@/lib/podcast-index";
import { lookupApple } from "@/lib/apple";
import { pollPodcastById } from "@/lib/poll";
import { processPendingForPodcast } from "@/lib/process";
import type { RecSource } from "@/lib/types";

type ActionResult = { ok: true; podcastId: string } | { ok: false; error: string };

/**
 * Follow a show by its Apple Podcasts id. `source` records where the person found
 * it (a recommendation, a chart, search...) so we can see which suggestions work.
 */
export async function followPodcast(itunesId: number, source: RecSource = "search"): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Please log in again." };

  // Look the show up ourselves rather than trusting data sent from the browser.
  // Podcast Index knows most shows by Apple id; otherwise match on the feed URL Apple lists.
  let show = await getPodcastByItunesId(itunesId);
  const apple = (await lookupApple([itunesId]))[0];
  if (!show && apple?.feedUrl) show = await getPodcastByFeedUrl(apple.feedUrl);
  if (!show || !show.rssUrl) return { ok: false, error: "Couldn't find that podcast's feed." };

  // One shared row per show, no matter how many people follow it.
  const admin = createAdminClient();
  const { data: podcast, error } = await admin
    .from("podcasts")
    .upsert(
      {
        podcast_index_id: show.podcastIndexId,
        itunes_id: itunesId,
        title: show.title,
        author: show.author,
        description: show.description,
        image_url: show.imageUrl || apple?.imageUrl || null,
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

  // Measurement only: never let it block the follow.
  await supabase.from("recommendations").upsert(
    {
      user_id: user.id,
      itunes_id: itunesId,
      source,
      title: show.title,
      author: show.author,
      image_url: show.imageUrl || apple?.imageUrl || null,
      followed_at: new Date().toISOString(),
    },
    { onConflict: "user_id,itunes_id,source" },
  );

  // First time anyone has followed this show: grab its latest episode right away,
  // then summarise it in the background so it's ready in a minute or two rather
  // than after the next scheduled run.
  if (!podcast.import_after) {
    await pollPodcastById(podcast.id);
    after(async () => {
      try {
        const results = await processPendingForPodcast(podcast.id);
        console.log("[follow] summarised new show:", JSON.stringify(results));
      } catch (err) {
        console.error("[follow] background summarise failed:", err);
      }
    });
  }

  revalidatePath("/settings");
  revalidatePath("/feed");
  revalidatePath("/discover");
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
  revalidatePath("/discover");
  return { ok: true, podcastId };
}
