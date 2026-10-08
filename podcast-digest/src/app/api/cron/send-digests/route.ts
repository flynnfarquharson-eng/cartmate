import { NextResponse, type NextRequest } from "next/server";
import { isCronOrAdmin } from "@/lib/cron-auth";
import { sendDueDigests } from "@/lib/digest";

export const maxDuration = 300;

/**
 * Sends every digest that's due: weekly ones on Sunday (Sydney time), daily ones each day.
 * Runs every morning; anyone not due is skipped, so running it twice is harmless.
 */
export async function GET(request: NextRequest) {
  if (!(await isCronOrAdmin(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const results = await sendDueDigests();
  const count = (s: string) => results.filter((r) => r.status === s).length;
  return NextResponse.json({
    sent: count("sent"),
    nothingNew: count("nothing-new"),
    notDue: count("not-due"),
    failed: count("failed"),
    results: results.filter((r) => r.status === "failed" || r.status === "sent"),
  });
}
