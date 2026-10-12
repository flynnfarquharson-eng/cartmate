import "server-only";
import { lookupApple, type AppleShow } from "@/lib/apple";

/**
 * Well-known business and self-improvement shows, shown as tap-to-follow covers on
 * the welcome screen and as "works with" covers on the landing page. Apple ids.
 */
export const POPULAR_SHOW_IDS = [
  1291423644, // The Diary Of A CEO
  1469759170, // My First Million
  1836497887, // David Senra
  1545953110, // Huberman Lab
  863897795, // The Tim Ferriss Show
  1646101002, // The Mel Robbins Podcast
  1150510297, // How I Built This
  1050462261, // Acquired
  990149481, // The Knowledge Project
  1347973549, // Modern Wisdom
  1502871393, // All-In
  1212097275, // Equity Mates Investing Podcast
];

/** The popular shows in list order, skipping any Apple doesn't return. */
export async function getPopularShows(): Promise<AppleShow[]> {
  const shows = await lookupApple(POPULAR_SHOW_IDS).catch(() => []);
  const byId = new Map(shows.map((s) => [s.itunesId, s]));
  return POPULAR_SHOW_IDS.map((id) => byId.get(id)).filter((s): s is AppleShow => !!s);
}

/** Apple titles are long ("The Diary Of A CEO with Steven Bartlett"): keep the part before " with " or ":". */
export function shortTitle(title: string): string {
  return title.split(/ with |: | - /)[0].trim();
}
