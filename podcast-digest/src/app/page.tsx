import { LoginForm } from "@/components/LoginForm";

export default async function Landing({ searchParams }: PageProps<"/">) {
  const params = await searchParams;
  const next = typeof params.next === "string" ? params.next : undefined;
  const linkError = params.error === "link";

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-12">
      <div className="mb-10">
        <div className="mb-6 grid h-12 w-12 place-items-center rounded-2xl bg-accent text-2xl text-white dark:text-black">
          ◉
        </div>
        <h1 className="text-3xl font-semibold tracking-tight">Podcast Digest</h1>
        <p className="mt-3 text-muted">
          Follow the shows you love. Get a short summary of every new episode, and keep every
          useful tip in one searchable library.
        </p>
      </div>

      {linkError && (
        <p className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          That login link didn&apos;t work (they expire and only work once). Please request a new
          one.
        </p>
      )}

      <LoginForm next={next} />

      <ul className="mt-10 space-y-2 text-sm text-muted">
        <li>• Summaries, key ideas and quotes for each episode</li>
        <li>• A personal library of actionable tips</li>
        <li>• Always links back to the original episode</li>
      </ul>
    </main>
  );
}
