"use client";

import { formatTimestamp } from "@/lib/format";

export const AUDIO_ELEMENT_ID = "episode-audio";

/**
 * A timestamp chip. On the episode page it jumps the audio player to that moment;
 * elsewhere (no player on the page) it links to the episode page.
 */
export function Timestamp({ seconds, href }: { seconds: number; href?: string }) {
  const className =
    "inline-flex shrink-0 items-center gap-1 rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-medium tabular-nums text-accent";
  const label = (
    <>
      <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M6 4l14 8-14 8z" />
      </svg>
      {formatTimestamp(seconds)}
    </>
  );

  if (href) {
    return (
      <a href={`${href}?t=${Math.floor(seconds)}`} className={className}>
        {label}
      </a>
    );
  }
  return (
    <button
      type="button"
      className={className}
      aria-label={`Play from ${formatTimestamp(seconds)}`}
      onClick={() => {
        const audio = document.getElementById(AUDIO_ELEMENT_ID) as HTMLAudioElement | null;
        if (!audio) return;
        audio.currentTime = seconds;
        void audio.play();
        audio.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }}
    >
      {label}
    </button>
  );
}

/** The episode's audio player. Starts at ?t= when you arrive from a tip link. */
export function EpisodeAudio({ src, startAt }: { src: string; startAt?: number }) {
  return (
    <audio
      id={AUDIO_ELEMENT_ID}
      src={startAt ? `${src}#t=${startAt}` : src}
      controls
      preload="none"
      className="w-full"
    />
  );
}
