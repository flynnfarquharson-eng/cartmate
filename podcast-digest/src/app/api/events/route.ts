import { NextResponse, type NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { getUser } from "@/lib/supabase/server";
import { recordEvent, TRACKED_EVENTS, type TrackedEvent } from "@/lib/tracking";

const ANON_COOKIE = "pd_anon";

/** Records a click on a test button. Works for visitors who aren't logged in too. */
export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as { event?: string; props?: Record<string, unknown> };
  if (!TRACKED_EVENTS.includes(body.event as TrackedEvent)) {
    return NextResponse.json({ error: "Unknown event" }, { status: 400 });
  }

  const user = await getUser();
  const anonId = request.cookies.get(ANON_COOKIE)?.value ?? randomUUID();
  let ref: string | null = null;
  try {
    ref = JSON.parse(request.cookies.get("pd_src")?.value ?? "{}").ref ?? null;
  } catch {
    // ignore
  }

  // Keep stored props small and simple.
  const props = Object.fromEntries(
    Object.entries(body.props ?? {})
      .filter(([, v]) => ["string", "number", "boolean"].includes(typeof v))
      .slice(0, 5)
      .map(([k, v]) => [k.slice(0, 40), typeof v === "string" ? v.slice(0, 200) : v]),
  );
  await recordEvent(body.event as TrackedEvent, { userId: user?.id, anonId, ref, props });

  const response = NextResponse.json({ ok: true });
  if (!request.cookies.has(ANON_COOKIE)) {
    response.cookies.set(ANON_COOKIE, anonId, { maxAge: 365 * 24 * 3600, httpOnly: true, sameSite: "lax", path: "/" });
  }
  return response;
}
