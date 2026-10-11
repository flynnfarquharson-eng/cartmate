import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { ensureSubscription } from "@/lib/digest";
import { recordSignupSource } from "@/lib/tracking";

/** The magic link in the login email brings you here. */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const nextParam = searchParams.get("next") ?? "/feed";
  const next = nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/feed";

  const supabase = await createClient();
  let error: unknown = null;

  if (code) {
    ({ error } = await supabase.auth.exchangeCodeForSession(code));
  } else if (tokenHash && type) {
    ({ error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type }));
  } else {
    error = new Error("Missing code");
  }

  if (error) {
    return NextResponse.redirect(`${origin}/?error=link`);
  }

  // Signing up (the landing page says so) means agreeing to the weekly digest.
  // Clicking the emailed link confirms the address, which doubles as opt-in.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    await ensureSubscription(user.id, "signup");
    await recordSignupSource(user.id, request.cookies.get("pd_src")?.value);
  }

  return NextResponse.redirect(`${origin}${next}`);
}
