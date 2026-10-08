import { createAdminClient } from "@/lib/supabase/admin";

const LABELS: Record<string, string> = {
  claude: "Picked for you (Claude)",
  friends: "Popular with friends",
  chart: "Australian charts",
  search: "Search",
  link: "Pasted link",
};

/** Admin only: how often each kind of suggestion turns into a follow, across all users. */
export async function RecommendationStats() {
  const { data } = await createAdminClient().from("recommendations").select("source, followed_at");
  const rows = new Map<string, { shown: number; followed: number }>();
  for (const r of data ?? []) {
    const row = rows.get(r.source) ?? { shown: 0, followed: 0 };
    row.shown++;
    if (r.followed_at) row.followed++;
    rows.set(r.source, row);
  }
  if (!rows.size) return <p className="text-sm text-muted">No recommendation data yet.</p>;

  return (
    <table className="w-full text-sm">
      <thead className="text-left text-xs text-muted">
        <tr>
          <th className="py-1 font-medium">Source</th>
          <th className="py-1 text-right font-medium">Shown</th>
          <th className="py-1 text-right font-medium">Followed</th>
          <th className="py-1 text-right font-medium">Rate</th>
        </tr>
      </thead>
      <tbody>
        {Object.keys(LABELS)
          .filter((s) => rows.has(s))
          .map((s) => {
            const { shown, followed } = rows.get(s)!;
            // Search and links are only logged when followed, so a rate means nothing there.
            const rate = s === "search" || s === "link" ? "–" : `${Math.round((followed / shown) * 100)}%`;
            return (
              <tr key={s} className="border-t border-border">
                <td className="py-1.5">{LABELS[s]}</td>
                <td className="py-1.5 text-right tabular-nums">{shown}</td>
                <td className="py-1.5 text-right tabular-nums">{followed}</td>
                <td className="py-1.5 text-right tabular-nums">{rate}</td>
              </tr>
            );
          })}
      </tbody>
    </table>
  );
}
