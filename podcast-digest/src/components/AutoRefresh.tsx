"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** While something is in progress, reload the page's data every few seconds (for up to 10 minutes). */
export function AutoRefresh({ active, everyMs = 4000 }: { active: boolean; everyMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    const started = Date.now();
    const timer = setInterval(() => {
      if (Date.now() - started > 10 * 60 * 1000) return clearInterval(timer);
      router.refresh();
    }, everyMs);
    return () => clearInterval(timer);
  }, [active, everyMs, router]);
  return null;
}
