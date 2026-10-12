"use client";

import { useEffect, useRef, useState } from "react";
import { track } from "@/lib/track-client";

// Founding member test. Until a Stripe Payment Link is set in NEXT_PUBLIC_FOUNDING_LINK,
// clicking only records interest; nobody is charged.
export const FOUNDING_PRICE = "A$4";
export const REGULAR_PRICE = "A$7";
const PAYMENT_LINK = process.env.NEXT_PUBLIC_FOUNDING_LINK;

const PERKS = [
  "Follow unlimited shows (free accounts will be capped at 3)",
  "Daily digest, or weekly",
  "Full tips library with search",
  "Founding price locked in for life",
];

export function FoundingOffer({ email, userId, placement }: { email: string; userId: string; placement: string }) {
  const [state, setState] = useState<"idle" | "interested">("idle");
  const viewed = useRef(false);

  useEffect(() => {
    if (viewed.current) return;
    viewed.current = true;
    track("founding_offer_view", { placement });
  }, [placement]);

  function join() {
    track("founding_offer_click", { placement, mode: PAYMENT_LINK ? "payment" : "waitlist" });
    if (PAYMENT_LINK) {
      const url = new URL(PAYMENT_LINK);
      url.searchParams.set("prefilled_email", email);
      url.searchParams.set("client_reference_id", userId);
      window.location.href = url.toString();
    } else {
      setState("interested");
    }
  }

  return (
    <div className="rounded-2xl border border-accent bg-accent-soft p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-accent">Founding members</p>
      <p className="mt-1 text-lg font-semibold">
        Podie Pro: {FOUNDING_PRICE}/month{" "}
        <span className="text-sm font-normal text-muted line-through">{REGULAR_PRICE}</span>
      </p>
      <ul className="mt-2 space-y-1 text-sm">
        {PERKS.map((p) => (
          <li key={p}>✓ {p}</li>
        ))}
      </ul>
      {state === "interested" ? (
        <p className="mt-3 text-sm text-accent">
          Thanks! Pro isn&apos;t open yet. We&apos;ll email you first, with the founding price saved for you. You
          haven&apos;t been charged.
        </p>
      ) : (
        <button
          onClick={join}
          className="mt-3 w-full rounded-full bg-accent px-4 py-2.5 font-medium text-white dark:text-black"
        >
          Become a founding member
        </button>
      )}
    </div>
  );
}
