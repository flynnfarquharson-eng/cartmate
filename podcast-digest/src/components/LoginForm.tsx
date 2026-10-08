"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function LoginForm({ next, cta = "Email me a login link" }: { next?: string; cta?: string }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [message, setMessage] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setState("sending");
    const supabase = createClient();
    const redirect = new URL("/auth/callback", window.location.origin);
    if (next) redirect.searchParams.set("next", next);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirect.toString() },
    });
    if (error) {
      setState("error");
      setMessage(error.message);
    } else {
      setState("sent");
    }
  }

  if (state === "sent") {
    return (
      <div className="rounded-2xl border border-border bg-surface p-5 text-center">
        <p className="font-medium">Check your inbox</p>
        <p className="mt-1 text-sm text-muted">
          We sent a link to <span className="text-text">{email}</span>. Tap it on this device to
          confirm and pick your shows.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <input
        type="email"
        required
        autoComplete="email"
        inputMode="email"
        placeholder="you@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-base outline-none focus:border-accent"
      />
      <button
        type="submit"
        disabled={state === "sending"}
        className="w-full rounded-xl bg-accent px-4 py-3 font-medium text-white disabled:opacity-60 dark:text-black"
      >
        {state === "sending" ? "Sending…" : cta}
      </button>
      {state === "error" && <p className="text-sm text-red-600">{message}</p>}
    </form>
  );
}
