/** Status of a summary being made, shown like a download: a label and a moving bar. */
const STAGES: Record<string, { label: string; percent: number }> = {
  pending: { label: "Queued", percent: 10 },
  transcribing: { label: "Listening to the episode…", percent: 40 },
  summarising: { label: "Writing the summary…", percent: 75 },
};

/** Being worked on right now (not just waiting in the queue). */
export function isInProgress(status: string) {
  return status === "transcribing" || status === "summarising";
}

export function SummaryProgress({ status, note }: { status: string; note?: string }) {
  const stage = STAGES[status] ?? STAGES.pending;
  const active = status !== "pending";
  return (
    <div className="w-full" role="status">
      <div className="flex justify-between text-xs">
        <span className="font-medium text-accent">{stage.label}</span>
        <span className="text-muted">{note ?? (active ? "About a minute" : "")}</span>
      </div>
      <div className="relative mt-1.5 h-1.5 overflow-hidden rounded-full bg-accent-soft">
        <div className="h-full rounded-full bg-accent transition-[width] duration-700" style={{ width: `${stage.percent}%` }} />
        {active && <div className="progress-slide absolute inset-y-0 left-0 w-1/3 bg-white/40" />}
      </div>
    </div>
  );
}
