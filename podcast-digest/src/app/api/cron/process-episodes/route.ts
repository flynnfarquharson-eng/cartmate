import { NextResponse, type NextRequest } from "next/server";
import { isCronOrAdmin } from "@/lib/cron-auth";
import { processPendingEpisodes } from "@/lib/process";

// Give the job up to 5 minutes on Vercel.
export const maxDuration = 300;

/**
 * Transcribes and summarises the next few pending episodes.
 * Each episode is processed once and shared by every follower of the show.
 */
export async function GET(request: NextRequest) {
  if (!(await isCronOrAdmin(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
