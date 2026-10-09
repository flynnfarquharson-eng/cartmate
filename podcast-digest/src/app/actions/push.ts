"use server";

import { createClient } from "@/lib/supabase/server";
import { pushToUsers } from "@/lib/push";

type Result = { ok: true } | { ok: false; error: string };
type Subscription = { endpoint: string; keys: { p256dh: string; auth: string } };

export async function savePushSubscription(sub: Subscription): Promise<Result> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Please log in again." };
  if (!sub?.endpoint?.startsWith("https://") || !sub.keys?.p256dh || !sub.keys?.auth) {
    return { ok: false, error: "Your browser sent an invalid subscription." };
  }

  const { error } = await supabase.from("push_subscriptions").upsert(
    { endpoint: sub.endpoint, user_id: user.id, p256dh: sub.keys.p256dh, auth: sub.keys.auth },
    { onConflict: "endpoint" },
  );
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function removePushSubscription(endpoint: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function sendTestNotification(): Promise<Result> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Please log in again." };
  const delivered = await pushToUsers([user.id], {
    title: "Notifications are on",
    body: "You'll get a ping when a new summary from your shows is ready.",
    url: "/feed",
    tag: "test",
  });
  return delivered ? { ok: true } : { ok: false, error: "Couldn't reach this device. Try turning notifications off and on." };
}
