import Link from "next/link";

export const metadata = { title: "Unsubscribe · Podcast Digest" };

export default async function UnsubscribePage({ searchParams }: PageProps<"/unsubscribe">) {
  const params = await searchParams;
  const token = typeof params.token === "string" ? params.token : "";
  const done = params.done === "1";

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-12 text-center">
      {done ? (
        <>
          <h1 className="text-2xl font-semibold">You&apos;re unsubscribed</h1>
          <p className="mt-2 text-muted">You won&apos;t get any more digest emails. Your account and saved tips are still here.</p>
          <p className="mt-6 text-sm text-muted">
            Changed your mind? Turn it back on in{" "}
            <Link href="/settings" className="text-accent">
              Settings
            </Link>
            .
          </p>
        </>
      ) : token ? (
        <>
          <h1 className="text-2xl font-semibold">Unsubscribe from the digest?</h1>
          <p className="mt-2 text-muted">You&apos;ll stop getting the weekly email. You can still use the app.</p>
          <form method="post" action={`/api/unsubscribe?token=${encodeURIComponent(token)}`} className="mt-6">
            <button className="w-full rounded-full bg-accent px-5 py-3 font-medium text-white dark:text-black">
              Unsubscribe
            </button>
          </form>
        </>
      ) : (
        <>
          <h1 className="text-2xl font-semibold">Unsubscribe</h1>
          <p className="mt-2 text-muted">
            Use the link at the bottom of any digest email, or log in and turn it off in{" "}
            <Link href="/settings" className="text-accent">
              Settings
            </Link>
            .
          </p>
        </>
      )}
    </main>
  );
}
