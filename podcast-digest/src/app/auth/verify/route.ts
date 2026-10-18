import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { finishLogin } from "@/lib/login";

/**
 * The login form posts the emailed code here. Checking it on the server means the session
 * cookies arrive as Set-Cookie headers, which Safari keeps. Cookies written by browser
 * JavaScript are wiped by Safari after 7 days, which logged people out.
 */
export async function POST(request: NextRequest) {
  const { email, code } = (await request.json().catch(() => ({}))) as { email?: string; code?: string };
  if (!email || !code) return NextResponse.json({ ok: false }, { status: 400 });

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ email, token: code.trim(), type: "email" });
  if (error) return NextResponse.json({ ok: false }, { status: 401 });

  await finishLogin(supabase, request.cookies.get("pd_src")?.value);
  return NextResponse.json({ ok: true });
}
