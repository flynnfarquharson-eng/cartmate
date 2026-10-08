const STYLES: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  transcribing: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300",
  summarising: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300",
  done: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  failed: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
};

const LABELS: Record<string, string> = {
  pending: "Summary coming soon",
  transcribing: "Transcribing…",
  summarising: "Summarising…",
  done: "Summary ready",
  failed: "Couldn't summarise",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${STYLES[status] ?? STYLES.pending}`}
    >
      {LABELS[status] ?? status}
    </span>
  );
}
