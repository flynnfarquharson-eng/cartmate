import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";

// Sonnet: in a blind test (Oct 2026) every summary was good enough to send, with the fewest
// factual errors, at under half Opus's cost. Haiku invented numbers and quotes.
const MODEL = "claude-sonnet-5-5";

const SummarySchema = z.object({
  overview: z.string().describe("3-5 sentence plain-English overview of the episode."),
  key_ideas: z
    .array(
      z.object({
        title: z.string().describe("Short headline for the idea, under 10 words."),
        detail: z.string().describe("1-3 sentences explaining the idea."),
      }),
    )
    .describe("The 4-8 most important ideas, in the order they come up."),
  quotes: z
    .array(
      z.object({
        quote: z.string().describe("Exact words from the transcript."),
        speaker: z.string().nullable().describe("Speaker name if clear from context, else null."),
        timestamp_seconds: z
          .number()
          .int()
          .nullable()
          .describe("Seconds from the start, from the nearest [mm:ss] marker. Null if the transcript has none."),
      }),
    )
    .describe("2-5 memorable quotes."),
  resources: z
    .array(
      z.object({
        name: z.string(),
        // Smaller models sometimes invent a type (e.g. "company"): keep the resource, file it under "other".
        type: z.enum(["book", "website", "product", "tool", "person", "study", "podcast", "other"]).catch("other"),
        url: z.string().nullable().describe("Only if the URL is stated in the episode or description, else null."),
      }),
    )
    .describe("Books, tools, studies, people etc. mentioned. Empty if none."),
  tips: z
    .array(
      z.object({
        tip: z
          .string()
          .describe("One concrete, actionable tip a listener could apply, written as an instruction. 1-2 sentences."),
        category: z.string().describe("One or two word topic, e.g. Sleep, Fitness, Money, Productivity."),
        timestamp_seconds: z.number().int().nullable(),
      }),
    )
    .describe("0-10 practical tips. Only include genuinely actionable advice, not general observations."),
});

export type EpisodeSummary = z.infer<typeof SummarySchema>;

const SYSTEM = `You summarise podcast episodes for busy listeners who want the useful parts without listening to the whole thing.

Write in clear, plain English. Be specific: keep the numbers, names, and concrete steps that make an idea useful, and drop filler, ads, and sponsor reads. Never invent anything that isn't in the transcript. When the transcript has [mm:ss] or [h:mm:ss] markers, convert the nearest marker before a quote or tip into seconds for its timestamp.

Quotes must be word for word from one continuous passage. Never join separate passages or finish a sentence that was cut off. Attribute each quote to the person who actually said those words: if a host reads out or relays someone else's words, name the original speaker, or use null if unsure.

Only list resources that are discussed in the episode itself. Skip sponsors and ads, including links that only appear in the episode description.`;

let client: Anthropic | null = null;

export type SummariseOptions = {
  /** Defaults to MODEL. Haiku has no effort setting, so it is left out for Haiku. */
  model?: string;
  /** Called with token counts, e.g. to compare model costs. */
  onUsage?: (usage: { input_tokens: number; output_tokens: number }) => void;
};

export async function summariseEpisode(
  input: {
    podcastTitle: string;
    episodeTitle: string;
    description: string | null;
    transcript: string;
  },
  options: SummariseOptions = {},
): Promise<EpisodeSummary> {
  client ??= new Anthropic();
  const model = options.model ?? MODEL;
  const format = betaZodOutputFormat(SummarySchema);

  const response = await client.beta.messages.parse({
    model,
    max_tokens: 16000,
    system: SYSTEM,
    output_config: model.startsWith("claude-haiku") ? { format } : { effort: "medium", format },
    // If Claude's safety checks decline the request, the API retries on a fallback model.
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    messages: [
      {
        role: "user",
        content: [
          `Podcast: ${input.podcastTitle}`,
          `Episode: ${input.episodeTitle}`,
          input.description ? `Episode description: ${input.description}` : null,
          "",
          "<transcript>",
          input.transcript,
          "</transcript>",
        ]
          .filter((line) => line !== null)
          .join("\n"),
      },
    ],
  });

  options.onUsage?.(response.usage);
  if (response.stop_reason === "refusal") {
    throw new Error(`Claude declined to summarise this episode (${response.stop_details?.category ?? "no category"}).`);
  }
  if (response.stop_reason === "max_tokens") {
    throw new Error("Summary was cut off (hit max_tokens).");
  }
  if (!response.parsed_output) throw new Error("Claude returned a summary that didn't match the expected format.");
  return response.parsed_output;
}
