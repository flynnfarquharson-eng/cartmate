import { NextResponse, type NextRequest } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/env";
import { pollAllFollowedPodcasts } from "@/lib/poll";

// Give the job up to 5 minutes on Vercel.
export const maxDuration = 300;

/**
 * Checks every followed show for new episodes.
 * Called hourly by Vercel Cron (which sends "Authorization: Bearer <CRON_SECRET>").
 * The admin can also just open this URL in a browser while logged in.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const fromCron = !!secret && request.headers.get("authorization") === `Bearer ${secret}`;
  if (!fromCron) {
    const user = await getUser();
    if (!isAdminEmail(user?.email)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const started = Date.now();
  const results = await pollAllFollowedPodcasts();
  return NextResponse.json({
    checked: results.length,
    newEpisodes: results.reduce((n, r) => n + r.newEpisodes, 0),
    errors: results.filter((r) => r.error).length,
    durationMs: Date.now() - started,
    results,
  });
}
