"use client";

import { useEffect, useRef, useState } from "react";
import { PodcastArt } from "@/components/PodcastArt";
import { FollowButton } from "@/components/FollowButton";
import type { PodcastSearchResult } from "@/lib/podcast-index";

export function SearchClient({ followed }: { followed: Record<number, string> }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PodcastSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const latest = useRef(0);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      latest.current++; // ignore any search still in flight
      return;
    }
    const id = ++latest.current;
    const timer = setTimeout(async () => {
      setLoading(true);
      setError("");
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        if (id !== latest.current) return; // a newer search has started
        if (!res.ok) throw new Error(data.error ?? "Search failed");
        setResults(data.results);
      } catch (err) {
        if (id === latest.current) setError(err instanceof Error ? err.message : "Search failed");
      } finally {
        if (id === latest.current) setLoading(false);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [query]);

  const active = query.trim().length >= 2;
  const shown = active ? results : [];

  return (
    <div>
      <input
        type="search"
        autoFocus
        placeholder="Search podcasts by name or topic"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-base outline-none focus:border-accent"
      />

      <div className="mt-2 h-5 text-sm text-muted">
        {active && loading ? "Searching…" : active && error ? <span className="text-red-600">{error}</span> : null}
      </div>

      <ul className="space-y-2">
        {shown.map((r) => (
          <li
            key={r.podcastIndexId}
            className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-3"
          >
            <PodcastArt src={r.imageUrl} alt={r.title} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{r.title}</p>
              <p className="truncate text-sm text-muted">{r.author}</p>
              {r.episodeCount != null && (
                <p className="text-xs text-muted">{r.episodeCount} episodes</p>
              )}
            </div>
            <FollowButton
              podcastIndexId={r.podcastIndexId}
              podcastId={followed[r.podcastIndexId] ?? null}
            />
          </li>
        ))}
      </ul>

      {active && !loading && results.length === 0 && !error && (
        <p className="mt-6 text-center text-sm text-muted">No podcasts found.</p>
      )}
    </div>
  );
}
