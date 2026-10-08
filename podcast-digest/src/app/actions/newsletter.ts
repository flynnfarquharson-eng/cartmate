"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { ensureSubscription, sendPreviewTo } from "@/lib/digest";

type Frequency = "weekly" | "daily" | "off";
type Result = { ok: true; message?: string } | { ok: false; error: string };

export async function setDigestFrequency(frequency: Frequency): Promise<Result> {
  if (!["weekly", "daily", "off"].includes(frequency)) return { ok: false, error: "Unknown option." };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Please log in again." };

  await ensureSubscription(user.id, "settings");
  const { error } = await supabase
    .from("newsletter_subscriptions")
    .update({ frequency, updated_at: new Date().toISOString() })
    .eq("user_id", user.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/settings");
  return { ok: true };
}

export async function sendMeAPreview(): Promise<Result> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Please log in again." };

  const result = await sendPreviewTo(user.id);
  if (result.status === "sent") return { ok: true, message: `Sent to ${user.email} with ${result.episodes} episodes.` };
  if (result.status === "nothing-new") return { ok: false, error: "No summaries from the past week yet, so there's nothing to send." };
  return { ok: false, error: result.error ?? "Couldn't send the preview." };
}
