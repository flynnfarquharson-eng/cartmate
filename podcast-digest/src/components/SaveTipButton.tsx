"use client";

import { useState, useTransition } from "react";
import { setTipSaved } from "@/app/actions/tips";

export function SaveTipButton({ tipId, saved: initialSaved }: { tipId: string; saved: boolean }) {
  const [saved, setSaved] = useState(initialSaved);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function toggle() {
    const next = !saved;
    setSaved(next); // update straight away, undo if the save fails
    setError("");
    startTransition(async () => {
      const res = await setTipSaved(tipId, next);
      if (!res.ok) {
        setSaved(!next);
        setError(res.error);
      }
    });
  }

  return (
    <div className="flex shrink-0 flex-col items-end">
      <button
        onClick={toggle}
        disabled={pending}
        aria-pressed={saved}
        aria-label={saved ? "Remove from saved tips" : "Save tip"}
        className={`grid h-8 w-8 place-items-center rounded-full transition disabled:opacity-60 ${
          saved ? "bg-accent-soft text-accent" : "text-muted hover:text-text"
        }`}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill={saved ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
        </svg>
      </button>
      {error && <span className="mt-1 max-w-32 text-right text-xs text-red-600">{error}</span>}
    </div>
  );
}
