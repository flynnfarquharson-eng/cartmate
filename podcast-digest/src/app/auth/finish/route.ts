import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { finishLogin } from "@/lib/login";

/** Logging in with the emailed code lands here: same sign-up steps as the link, then on to the app. */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const nextParam = searchParams.get("next") ?? "/feed";
  const next = nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/feed";
  const supabase = await createClient();
  const ok = await finishLogin(supabase, request.cookies.get("pd_src")?.value);
  return NextResponse.redirect(`${origin}${ok ? next : "/"}`);
}
