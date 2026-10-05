"use client";

import { useState, useTransition } from "react";
import { followPodcast, unfollowPodcast } from "@/app/actions/follows";

/** Follow / Following toggle for a search result. */
export function FollowButton({
  podcastIndexId,
  podcastId: initialPodcastId,
}: {
  podcastIndexId: number;
  podcastId: string | null;
}) {
  const [podcastId, setPodcastId] = useState(initialPodcastId);
  const [following, setFollowing] = useState(!!initialPodcastId);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function toggle() {
    setError("");
    startTransition(async () => {
      const res =
        following && podcastId
          ? await unfollowPodcast(podcastId)
          : await followPodcast(podcastIndexId);
      if (!res.ok) return setError(res.error);
      setPodcastId(res.podcastId);
      setFollowing(!following);
    });
  }

  return (
    <div className="flex flex-col items-end">
      <button
        onClick={toggle}
        disabled={pending}
        className={`min-w-[96px] rounded-full px-4 py-1.5 text-sm font-medium transition disabled:opacity-60 ${
          following
            ? "border border-border bg-surface text-text"
            : "bg-accent text-white dark:text-black"
        }`}
      >
        {pending ? "…" : following ? "Following" : "Follow"}
      </button>
      {error && <span className="mt-1 max-w-40 text-right text-xs text-red-600">{error}</span>}
    </div>
  );
}

/** Unfollow button for the settings page. */
export function UnfollowButton({ podcastId, title }: { podcastId: string; title: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  return (
    <div className="flex flex-col items-end">
      <button
        disabled={pending}
        onClick={() => {
          if (!confirm(`Unfollow "${title}"?`)) return;
          startTransition(async () => {
            const res = await unfollowPodcast(podcastId);
            if (!res.ok) setError(res.error);
          });
        }}
        className="rounded-full border border-border px-3 py-1 text-sm text-muted hover:text-red-600 disabled:opacity-60"
      >
        {pending ? "…" : "Unfollow"}
      </button>
      {error && <span className="mt-1 text-xs text-red-600">{error}</span>}
    </div>
  );
}
