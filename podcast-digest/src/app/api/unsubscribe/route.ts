import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Unsubscribe by the secret token in each email. No login needed.
 * POST is used both by email apps' one-click "Unsubscribe" button
 * (List-Unsubscribe-Post) and by the confirm button on /unsubscribe.
 */
export async function POST(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token") ?? "";
  if (!UUID.test(token)) return NextResponse.json({ error: "Invalid link" }, { status: 400 });

  const { error } = await createAdminClient()
    .from("newsletter_subscriptions")
    .update({ frequency: "off", updated_at: new Date().toISOString() })
    .eq("unsubscribe_token", token);
  if (error) return NextResponse.json({ error: "Something went wrong" }, { status: 500 });

  // Email apps' one-click button posts "List-Unsubscribe=One-Click" and just needs a 200.
  // The confirm button on /unsubscribe posts a normal form, so show the result page.
  const body = await request.text();
  if (body.includes("List-Unsubscribe=One-Click")) return NextResponse.json({ ok: true });
  return NextResponse.redirect(new URL("/unsubscribe?done=1", request.url), 303);
}

/** Link scanners open GET links automatically, so GET never unsubscribes. It shows the confirm page. */
export function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token") ?? "";
  return NextResponse.redirect(new URL(`/unsubscribe?token=${encodeURIComponent(token)}`, request.url));
}
