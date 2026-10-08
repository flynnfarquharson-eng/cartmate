"use client";

import { useActionState, useState } from "react";
import { savePreferences } from "@/app/actions/preferences";
import { INTERESTS } from "@/lib/interests";

export function WelcomeForm({ interests, favourites }: { interests: string[]; favourites: string[] }) {
  const [picked, setPicked] = useState(new Set(interests));
  const [state, action, pending] = useActionState(
    async (_prev: { error: string } | void, formData: FormData) => savePreferences(formData),
    undefined,
  );

  function toggle(name: string) {
    const next = new Set(picked);
    if (next.has(name)) next.delete(name);
    else next.add(name);
    setPicked(next);
  }

  return (
    <form action={action} className="space-y-8">
      <section>
        <h2 className="font-semibold">What are you into?</h2>
        <p className="text-sm text-muted">Pick as many as you like.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {INTERESTS.map(({ name }) => {
            const on = picked.has(name);
            return (
              <label
                key={name}
                className={`cursor-pointer select-none rounded-full border px-3 py-1.5 text-sm transition ${
                  on ? "border-accent bg-accent text-white dark:text-black" : "border-border bg-surface"
                }`}
              >
                <input type="checkbox" name="interest" value={name} checked={on} onChange={() => toggle(name)} className="sr-only" />
                {name}
              </label>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="font-semibold">Name up to 3 shows you love</h2>
        <p className="text-sm text-muted">Optional, but it makes the picks much better.</p>
        <div className="mt-3 space-y-2">
          {[0, 1, 2].map((i) => (
            <input
              key={i}
              name="favourite"
              defaultValue={favourites[i] ?? ""}
              placeholder={["e.g. My First Million", "e.g. Huberman Lab", "e.g. Hamish & Andy"][i]}
              className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-base outline-none focus:border-accent"
            />
          ))}
        </div>
      </section>

      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button
        disabled={pending}
        className="w-full rounded-full bg-accent px-5 py-3 font-medium text-white disabled:opacity-60 dark:text-black"
      >
        {pending ? "Saving…" : "Show me podcasts →"}
      </button>
    </form>
  );
}
