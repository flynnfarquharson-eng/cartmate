import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { findShowByName, type AppleShow } from "@/lib/apple";

const MODEL = "claude-opus-5-5";
/** Shows whose newest episode is older than this are treated as finished or dead. */
const MAX_DAYS_SINCE_EPISODE = 120;
const WANTED = 8;

const SuggestionsSchema = z.object({
  shows: z
    .array(
      z.object({
        title: z.string().describe("The show's exact name as it appears in Apple Podcasts."),
        author: z.string().describe("Host or network name."),
        reason: z
          .string()
          .describe("One short sentence, under 15 words, on why this person would like it. Refer to their interests or shows."),
      }),
    )
    .describe("14 podcast suggestions, best match first."),
});

const SYSTEM = `You recommend podcasts. The listener lives in Australia.

Only suggest real podcasts that you are confident exist and are still releasing episodes. Use each show's exact name as listed in Apple Podcasts. Mix well-known shows with a few less obvious picks that fit closely, and include Australian shows when they genuinely fit. Never suggest a show the listener already follows or named as a favourite.`;

export type Recommendation = AppleShow & { reason: string };

let client: Anthropic | null = null;

/**
 * Ask Claude for shows that fit someone's interests and favourites, then keep only
 * the ones we can find on Apple Podcasts with a recent episode. Claude can misremember
 * a name or suggest a show that has ended, so nothing is shown unverified.
 */
export async function recommendShows(input: {
  interests: string[];
  favouriteShows: string[];
  alreadyFollowing: string[];
  excludeItunesIds: Set<number>;
}): Promise<Recommendation[]> {
  client ??= new Anthropic();

  const response = await client.beta.messages.parse({
    model: MODEL,
    max_tokens: 8000,
    system: SYSTEM,
    output_config: { effort: "low", format: betaZodOutputFormat(SuggestionsSchema) },
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    messages: [
      {
        role: "user",
        content: [
          `Interests: ${input.interests.join(", ") || "not given"}`,
          `Shows they love: ${input.favouriteShows.join(", ") || "not given"}`,
          `Already following (don't suggest): ${input.alreadyFollowing.join(", ") || "none"}`,
        ].join("\n"),
      },
    ],
  });
  if (response.stop_reason === "refusal" || !response.parsed_output) return [];

  const cutoff = Date.now() - MAX_DAYS_SINCE_EPISODE * 24 * 3600 * 1000;
  const verified = await Promise.all(
    response.parsed_output.shows.map(async (s) => {
      try {
        const show = await findShowByName(s.title, s.author);
        if (!show || input.excludeItunesIds.has(show.itunesId)) return null;
        if (show.latestEpisodeAt && new Date(show.latestEpisodeAt).getTime() < cutoff) return null;
        return { ...show, reason: s.reason };
      } catch {
        return null;
      }
    }),
  );

  const seen = new Set<number>();
  return verified
    .filter((r): r is Recommendation => !!r && !seen.has(r.itunesId) && !!seen.add(r.itunesId))
    .slice(0, WANTED);
}
