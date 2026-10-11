import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export type CarouselData = {
  episodeId: string;
  episodeTitle: string;
  podcastTitle: string;
  imageUrl: string | null;
  tips: { text: string; timestampSeconds: number | null }[];
};

/** Instagram allows 10 slides: a cover, up to 8 tips, and a closing slide. */
export const MAX_TIP_SLIDES = 8;

export async function getCarouselData(episodeId: string): Promise<CarouselData | null> {
  const { data } = await createAdminClient()
    .from("episodes")
    .select("id, title, status, podcasts(title, image_url), tips(tip_text, timestamp_seconds)")
    .eq("id", episodeId)
    .maybeSingle();
  if (!data || data.status !== "done") return null;
  const podcast = data.podcasts as unknown as { title: string; image_url: string | null } | null;
  const tips = ((data.tips as unknown as { tip_text: string; timestamp_seconds: number | null }[]) ?? [])
    .sort((a, b) => (a.timestamp_seconds ?? 0) - (b.timestamp_seconds ?? 0))
    .slice(0, MAX_TIP_SLIDES)
    .map((t) => ({ text: t.tip_text, timestampSeconds: t.timestamp_seconds }));
  if (!tips.length) return null;
  return {
    episodeId: data.id,
    episodeTitle: data.title,
    podcastTitle: podcast?.title ?? "",
    imageUrl: podcast?.image_url ?? null,
    tips,
  };
}

/** Ready-to-paste Instagram caption, with credit to the show. */
export function carouselCaption(d: CarouselData): string {
  return [
    `${d.tips.length} takeaways from ${d.podcastTitle}: "${d.episodeTitle}"`,
    "",
    ...d.tips.slice(0, 3).map((t, i) => `${i + 1}. ${t.text}`),
    d.tips.length > 3 ? `…and ${d.tips.length - 3} more in the slides.` : "",
    "",
    `All credit to ${d.podcastTitle}. Listen to the full episode, it's worth it.`,
    "",
    "Want the best ideas from your favourite podcasts every Sunday? Free digest, link in bio.",
    "",
    "#podcasts #podcastsummary #learning #selfimprovement #entrepreneur",
  ]
    .filter((line, i, all) => line !== "" || all[i - 1] !== "")
    .join("\n");
}
