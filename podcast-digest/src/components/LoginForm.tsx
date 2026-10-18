"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Email sign-up and login. We email a code (and a link). Typing the code keeps people
 * inside Instagram's browser instead of bouncing them to their email app and back.
 */
export function LoginForm({ next, cta = "Email me a login code" }: { next?: string; cta?: string }) {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [resent, setResent] = useState(false);

  async function sendCode() {
    const supabase = createClient();
    const redirect = new URL("/auth/callback", window.location.origin);
    if (next) redirect.searchParams.set("next", next);
    return supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: redirect.toString() } });
  }

  async function onEmail(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    const { error } = await sendCode();
    setBusy(false);
    if (error) return setMessage(error.message);
    setStep("code");
  }

  async function onCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    // Checked on the server so the login cookies last (see /auth/verify).
    const res = await fetch("/auth/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, code }),
    }).catch(() => null);
    if (!res?.ok) {
      setBusy(false);
      return setMessage("That code didn't work. Check it, or send a new one.");
    }
    const target = next?.startsWith("/") && !next.startsWith("//") ? next : "/feed";
    window.location.assign(target);
  }

  const input = "w-full rounded-xl border border-border bg-surface px-4 py-3 text-base outline-none focus:border-accent";
  const button = "w-full rounded-xl bg-accent px-4 py-3 font-medium text-white disabled:opacity-60 dark:text-black";

  if (step === "code") {
    return (
      <form onSubmit={onCode} className="space-y-3">
        <p className="text-sm">
          We sent a code to <span className="font-medium">{email}</span>. Enter it here.
        </p>
        <input
          required
          autoFocus
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]{6,10}"
          maxLength={10}
          placeholder="Code from the email"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          className={`${input} tracking-[0.3em]`}
        />
        <button type="submit" disabled={busy || code.length < 6} className={button}>
          {busy ? "Checking…" : "Continue"}
        </button>
        {message && <p className="text-sm text-red-600">{message}</p>}
        <div className="flex justify-between text-xs text-muted">
          <button
            type="button"
            disabled={resent}
            onClick={async () => {
              setResent(true);
              const { error } = await sendCode();
              setMessage(error ? error.message : "");
            }}
            className="underline disabled:no-underline"
          >
            {resent ? "New code sent" : "Send a new code"}
          </button>
          <button
            type="button"
            onClick={() => {
              setStep("email");
              setCode("");
              setMessage("");
              setResent(false);
            }}
            className="underline"
          >
            Use a different email
          </button>
        </div>
      </form>
    );
  }

  return (
    <form onSubmit={onEmail} className="space-y-3">
      <input
        type="email"
        required
        autoComplete="email"
        inputMode="email"
        placeholder="you@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className={input}
      />
      <button type="submit" disabled={busy} className={button}>
        {busy ? "Sending…" : cta}
      </button>
      {message && <p className="text-sm text-red-600">{message}</p>}
    </form>
  );
}
