import { NextResponse, after, type NextRequest } from "next/server";
import { isCronOrAdmin } from "@/lib/cron-auth";
import { processPendingEpisodes } from "@/lib/process";

// Give the job up to 5 minutes on Vercel (this also covers work started with `after`).
export const maxDuration = 300;

/**
 * Transcribes and summarises the next few pending episodes.
 * Each episode is processed once and shared by every follower of the show.
 *
 * Add ?background=1 to reply straight away and keep working after the response.
 * External schedulers like cron-job.org give up after 30 seconds, and one episode
 * can take a minute.
 */
export async function GET(request: NextRequest) {
  if (!(await isCronOrAdmin(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (request.nextUrl.searchParams.get("background") === "1") {
    after(async () => {
      const results = await processPendingEpisodes();
      console.log("[process-episodes] background run:", JSON.stringify(results));
    });
    return NextResponse.json({ started: true }, { status: 202 });
  }

  const started = Date.now();
  const results = await processPendingEpisodes();
  return NextResponse.json({
    processed: results.filter((r) => r.status === "done").length,
    failed: results.filter((r) => r.status === "failed").length,
    skipped: results.filter((r) => r.status === "skipped").length,
    durationMs: Date.now() - started,
    results,
  });
}
