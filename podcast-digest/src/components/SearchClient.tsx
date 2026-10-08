"use client";

import { useEffect, useRef, useState } from "react";
import { ShowRow } from "@/components/ShowCard";
import type { RecSource, ShowSummary } from "@/lib/types";

/** Search box that also accepts a pasted Apple Podcasts or Spotify link. */
export function SearchClient({ followed }: { followed: Record<number, string> }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ShowSummary[]>([]);
  const [source, setSource] = useState<RecSource>("search");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const latest = useRef(0);

  const q = query.trim();
  const isLink = /^https?:\/\//i.test(q);

  useEffect(() => {
    if (q.length < 2) {
      latest.current++; // ignore any search still in flight
      return;
    }
    const id = ++latest.current;
    // Links are pasted all at once, so look them up straight away.
    const timer = setTimeout(async () => {
      setLoading(true);
      setError("");
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        if (id !== latest.current) return; // a newer search has started
        if (!res.ok) throw new Error(data.error ?? "Search failed");
        setResults(data.results);
        setSource(data.source ?? "search");
      } catch (err) {
        if (id === latest.current) {
          setResults([]);
          setError(err instanceof Error ? err.message : "Search failed");
        }
      } finally {
        if (id === latest.current) setLoading(false);
      }
    }, isLink ? 0 : 350);
    return () => clearTimeout(timer);
  }, [q, isLink]);

  const active = q.length >= 2;
  const shown = active ? results : [];

  return (
    <div>
      <input
        type="search"
        placeholder="Search a show, or paste an Apple / Spotify link"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-base outline-none focus:border-accent"
      />

      <div className="mt-2 min-h-5 text-sm text-muted">
        {active && loading ? (
          isLink ? "Finding that show…" : "Searching…"
        ) : active && error ? (
          <span className="text-red-600">{error}</span>
        ) : !active ? (
          <span className="text-xs">
            Tip: in Apple Podcasts or Spotify, tap Share → Copy link on a show, then paste it here.
          </span>
        ) : null}
      </div>

      <ul className="space-y-2">
        {shown.map((r) => (
          <ShowRow key={r.itunesId} show={r} source={source} podcastId={followed[r.itunesId] ?? null} />
        ))}
      </ul>

      {active && !loading && results.length === 0 && !error && (
        <p className="mt-6 text-center text-sm text-muted">No podcasts found.</p>
      )}
    </div>
  );
}
