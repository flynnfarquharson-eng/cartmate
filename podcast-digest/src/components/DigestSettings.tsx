"use client";

import { useState, useTransition } from "react";
import { sendMeAPreview, setDigestFrequency } from "@/app/actions/newsletter";

type Frequency = "weekly" | "daily" | "off";
const OPTIONS: { value: Frequency; label: string; hint: string }[] = [
  { value: "weekly", label: "Weekly", hint: "Sunday 7am" },
  { value: "daily", label: "Daily", hint: "7am, only when there's something new" },
  { value: "off", label: "Off", hint: "No emails" },
];

export function DigestSettings({ frequency: initial }: { frequency: Frequency }) {
  const [frequency, setFrequency] = useState(initial);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function choose(next: Frequency) {
    const previous = frequency;
    setFrequency(next);
    setNote(null);
    startTransition(async () => {
      const res = await setDigestFrequency(next);
      if (!res.ok) {
        setFrequency(previous);
        setNote({ ok: false, text: res.error });
      }
    });
  }

  function preview() {
    setNote(null);
    startTransition(async () => {
      const res = await sendMeAPreview();
      setNote(res.ok ? { ok: true, text: res.message ?? "Sent." } : { ok: false, text: res.error });
    });
  }

  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Digest frequency">
        {OPTIONS.map((o) => (
          <button
            key={o.value}
            role="radio"
            aria-checked={frequency === o.value}
            disabled={pending}
            onClick={() => choose(o.value)}
            className={`rounded-xl border px-2 py-2 text-left transition disabled:opacity-60 ${
              frequency === o.value ? "border-accent bg-accent-soft" : "border-border"
            }`}
          >
            <span className={`block text-sm font-medium ${frequency === o.value ? "text-accent" : ""}`}>{o.label}</span>
            <span className="block text-[11px] leading-tight text-muted">{o.hint}</span>
          </button>
        ))}
      </div>
      <button onClick={preview} disabled={pending} className="mt-3 text-sm text-accent disabled:opacity-60">
        {pending ? "Working…" : "Email me a preview now"}
      </button>
      {note && <p className={`mt-2 text-sm ${note.ok ? "text-emerald-600" : "text-red-600"}`}>{note.text}</p>}
    </div>
  );
}
