"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { requestSummary } from "@/app/actions/follows";
import { SummaryProgress } from "@/components/SummaryProgress";
import { AutoRefresh } from "@/components/AutoRefresh";

/** "Get summary" for one episode from a show's list. Shows progress straight away. */
export function GetSummaryButton({ itunesId, guid, label = "Get summary" }: { itunesId: number; guid: string; label?: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [started, setStarted] = useState(false);
  const [error, setError] = useState("");

  if (pending || started) {
    return (
      <>
        <SummaryProgress status="transcribing" note="Starting…" />
        {/* Keep checking until the page shows the real status. */}
        <AutoRefresh active={started} />
      </>
    );
  }

  return (
    <div className="flex flex-col items-end">
      <button
        onClick={() => {
          setError("");
          startTransition(async () => {
            const res = await requestSummary(itunesId, guid);
            if (!res.ok) return setError(res.error);
            if (res.ready) return router.push(`/episode/${res.episodeId}`);
            setStarted(true);
            router.refresh();
          });
        }}
        className="inline-flex items-center gap-1.5 rounded-full border border-accent px-3 py-1.5 text-xs font-medium text-accent transition hover:bg-accent-soft"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M12 4v11m0 0-4.5-4.5M12 15l4.5-4.5M5 20h14" />
        </svg>
        {label}
      </button>
      {error && <span className="mt-1 max-w-48 text-right text-xs text-red-600">{error}</span>}
    </div>
  );
}
