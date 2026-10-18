import "server-only";
import type { createClient } from "@/lib/supabase/server";
import { ensureSubscription } from "@/lib/digest";
import { recordSignupSource } from "@/lib/tracking";

/**
 * After any login (link or code). Signing up (the landing page says so) means agreeing
 * to the weekly digest, and confirming the emailed link or code doubles as opt-in.
 */
export async function finishLogin(supabase: Awaited<ReturnType<typeof createClient>>, sourceCookie: string | undefined) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;
  await ensureSubscription(user.id, "signup");
  await recordSignupSource(user.id, sourceCookie);
  return true;
}
