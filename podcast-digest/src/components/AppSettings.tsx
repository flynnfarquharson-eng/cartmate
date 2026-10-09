"use client";

import { useEffect, useState, useSyncExternalStore, useTransition } from "react";
import { removePushSubscription, savePushSubscription, sendTestNotification } from "@/app/actions/push";

type Env = { standalone: boolean; ios: boolean; pushSupported: boolean };

const noopSubscribe = () => () => {};
let cachedEnv: Env | null = null;
function readEnv(): Env {
  cachedEnv ??= {
    standalone:
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true,
    ios: /iPad|iPhone|iPod/.test(navigator.userAgent),
    pushSupported: "serviceWorker" in navigator && "PushManager" in window && "Notification" in window,
  };
  return cachedEnv;
}

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

/** "Install the app" guide and the notifications switch, on the Settings page. */
export function AppSettings() {
  // Browser-only details; null while rendering on the server.
  const env = useSyncExternalStore(noopSubscribe, readEnv, () => null);
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!env?.pushSupported) return;
    navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .then((reg) => reg.pushManager.getSubscription())
      .then(setSubscription)
      .catch(() => {});
  }, [env?.pushSupported]);

  if (!env) return null;

  function turnOn() {
    setNote(null);
    startTransition(async () => {
      try {
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          setNote({ ok: false, text: "Notifications are blocked. Allow them for this app in your phone's settings." });
          return;
        }
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!),
        });
        const res = await savePushSubscription(JSON.parse(JSON.stringify(sub)));
        if (!res.ok) throw new Error(res.error);
        setSubscription(sub);
        setNote({ ok: true, text: "Done. You'll get a ping when a new summary is ready." });
      } catch (err) {
        setNote({ ok: false, text: err instanceof Error ? err.message : "Couldn't turn on notifications." });
      }
    });
  }

  function turnOff() {
    setNote(null);
    startTransition(async () => {
      if (subscription) {
        await removePushSubscription(subscription.endpoint);
        await subscription.unsubscribe();
      }
      setSubscription(null);
    });
  }

  function test() {
    setNote(null);
    startTransition(async () => {
      const res = await sendTestNotification();
      setNote(res.ok ? { ok: true, text: "Sent. It should arrive in a few seconds." } : { ok: false, text: res.error });
    });
  }

  return (
    <div className="space-y-3 rounded-2xl border border-border bg-surface p-4">
      {!env.standalone && (
        <div>
          <p className="font-medium">Add Podcast Digest to your home screen</p>
          <p className="mt-1 text-sm text-muted">
            {env.ios ? (
              <>
                In Safari, tap the <strong>Share</strong> button (the square with an arrow), then{" "}
                <strong>Add to Home Screen</strong>.
              </>
            ) : (
              <>
                In Chrome, tap the <strong>⋮</strong> menu, then <strong>Install app</strong> or{" "}
                <strong>Add to Home screen</strong>. On a computer, click the install icon in the address bar.
              </>
            )}
          </p>
        </div>
      )}

      <div className={!env.standalone ? "border-t border-border pt-3" : ""}>
        <p className="font-medium">Notifications</p>
        {env.ios && !env.standalone ? (
          <p className="mt-1 text-sm text-muted">
            On iPhone, add the app to your home screen first, then open it from there to turn on notifications.
          </p>
        ) : !env.pushSupported ? (
          <p className="mt-1 text-sm text-muted">This browser doesn&apos;t support notifications.</p>
        ) : subscription ? (
          <div className="mt-2 flex flex-wrap gap-2">
            <span className="text-sm text-emerald-600">On for this device.</span>
            <button onClick={test} disabled={pending} className="text-sm text-accent disabled:opacity-60">
              Send a test
            </button>
            <button onClick={turnOff} disabled={pending} className="text-sm text-muted disabled:opacity-60">
              Turn off
            </button>
          </div>
        ) : (
          <>
            <p className="mt-1 text-sm text-muted">Get a ping when a new summary from your shows is ready.</p>
            <button
              onClick={turnOn}
              disabled={pending}
              className="mt-2 rounded-full bg-accent px-4 py-1.5 text-sm font-medium text-white disabled:opacity-60 dark:text-black"
            >
              {pending ? "…" : "Turn on notifications"}
            </button>
          </>
        )}
        {note && <p className={`mt-2 text-sm ${note.ok ? "text-emerald-600" : "text-red-600"}`}>{note.text}</p>}
      </div>
    </div>
  );
}
