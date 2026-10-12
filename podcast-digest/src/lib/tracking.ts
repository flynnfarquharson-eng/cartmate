import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/** Events the test buttons can record. Anything else is rejected. */
export const TRACKED_EVENTS = ["app_store_click", "founding_offer_view", "founding_offer_click", "carousel_download"] as const;
export type TrackedEvent = (typeof TRACKED_EVENTS)[number];
/** Events only the server records (never accepted from the browser). */
type ServerEvent = "summary_request";

/** Save where someone came from, the first time they log in. Never overwrites. */
export async function recordSignupSource(userId: string, cookieValue: string | undefined) {
  let source: Record<string, string> = {};
  try {
    source = cookieValue ? JSON.parse(cookieValue) : {};
  } catch {
    // ignore a malformed cookie
  }
  const pick = (k: string) => (typeof source[k] === "string" ? source[k].slice(0, 100) : null);
  await createAdminClient()
    .from("signup_sources")
    .upsert(
      {
        user_id: userId,
        ref: pick("ref"),
        utm_source: pick("utm_source"),
        utm_medium: pick("utm_medium"),
        utm_campaign: pick("utm_campaign"),
        landing_path: pick("landing_path"),
      },
      { onConflict: "user_id", ignoreDuplicates: true },
    );
}

export async function recordEvent(event: TrackedEvent | ServerEvent, details: { userId?: string | null; anonId?: string | null; ref?: string | null; props?: Record<string, unknown> }) {
  await createAdminClient()
    .from("product_events")
    .insert({
      event,
      user_id: details.userId ?? null,
      anon_id: details.anonId?.slice(0, 64) ?? null,
      ref: details.ref?.slice(0, 100) ?? null,
      props: details.props ?? {},
    });
}
