import "server-only";
import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";

let configured = false;
function configure(): boolean {
  if (configured) return true;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return false; // push not set up: skip quietly
  const contact = process.env.CONTACT_EMAIL || process.env.ADMIN_EMAIL || "admin@example.com";
  webpush.setVapidDetails(`mailto:${contact}`, publicKey, privateKey);
  configured = true;
  return true;
}

export type PushMessage = { title: string; body: string; url: string; tag?: string; icon?: string | null };

/** Send a notification to every device of the given users. Dead subscriptions are removed. */
export async function pushToUsers(userIds: string[], message: PushMessage): Promise<number> {
  if (!userIds.length || !configure()) return 0;
  const db = createAdminClient();
  const { data: subs } = await db.from("push_subscriptions").select("endpoint, p256dh, auth").in("user_id", userIds);
  let delivered = 0;
  await Promise.all(
    (subs ?? []).map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify({ ...message, icon: message.icon ?? "/icon-192.png" }),
          { TTL: 24 * 3600 },
        );
        delivered++;
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        // 404/410: the person uninstalled the app or turned notifications off.
        if (status === 404 || status === 410) {
          await db.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
        } else {
          console.error("[push] send failed:", status, err instanceof Error ? err.message : err);
        }
      }
    }),
  );
  return delivered;
}

/** Tell everyone who follows a show that a new episode summary is ready. */
export async function notifySummaryReady(episode: { id: string; title: string; podcastId: string; podcastTitle: string }) {
  const db = createAdminClient();
  const { data: follows } = await db.from("user_follows").select("user_id").eq("podcast_id", episode.podcastId);
  const { data: podcast } = await db.from("podcasts").select("image_url").eq("id", episode.podcastId).maybeSingle();
  return pushToUsers(
    (follows ?? []).map((f) => f.user_id),
    {
      title: `New summary: ${episode.podcastTitle}`,
      body: episode.title,
      url: `/episode/${episode.id}`,
      tag: `episode-${episode.id}`,
      icon: podcast?.image_url,
    },
  );
}
