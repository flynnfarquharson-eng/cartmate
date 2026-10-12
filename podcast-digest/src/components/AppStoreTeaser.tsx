"use client";

import { useState } from "react";
import { track } from "@/lib/track-client";

/**
 * Test button: measures how many visitors want a store app before we build one.
 * There is no store app yet, so it says so and sends them back to the sign-up form.
 */
export function AppStoreTeaser() {
  const [clicked, setClicked] = useState(false);

  return (
    <div className="mt-6 flex flex-col items-center text-center">
      <p className="text-xs text-muted">Prefer an app?</p>
      <button
        type="button"
        onClick={() => {
          if (!clicked) track("app_store_click", { platform: /Android/i.test(navigator.userAgent) ? "android" : "ios" });
          setClicked(true);
        }}
        className="mt-1.5 inline-flex items-center gap-2 rounded-lg bg-black px-3 py-1.5 text-white dark:bg-white dark:text-black"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M16.4 12.6c0-2.4 2-3.5 2-3.6-1.1-1.6-2.8-1.8-3.4-1.8-1.4-.1-2.8.9-3.5.9-.7 0-1.8-.9-3-.8-1.5 0-3 .9-3.8 2.3-1.6 2.8-.4 7 1.2 9.3.8 1.1 1.7 2.4 2.9 2.3 1.2 0 1.6-.7 3-.7s1.8.7 3 .7c1.3 0 2.1-1.1 2.8-2.3.9-1.3 1.3-2.6 1.3-2.6s-2.5-1-2.5-3.7ZM14.2 5.6c.6-.8 1.1-1.9 1-3-.9 0-2.1.6-2.7 1.4-.6.7-1.1 1.8-1 2.9 1 .1 2.1-.5 2.7-1.3Z" />
        </svg>
        <span className="text-left leading-tight">
          <span className="block text-[9px] opacity-80">Download on the</span>
          <span className="block text-xs font-semibold">App Store</span>
        </span>
      </button>
      {clicked && (
        <div className="mt-3 rounded-xl bg-accent-soft p-3 text-sm text-accent">
          <p>
            The app is coming soon. Sign up and you&apos;ll be first to get it. Podie already works like an app on your
            phone: after signing up, add it to your home screen.
          </p>
          <button
            type="button"
            onClick={() => {
              const input = document.querySelector<HTMLInputElement>('input[type="email"]');
              input?.scrollIntoView({ behavior: "smooth", block: "center" });
              input?.focus({ preventScroll: true });
            }}
            className="mt-2 font-semibold underline"
          >
            Sign up with your email
          </button>
        </div>
      )}
    </div>
  );
}
