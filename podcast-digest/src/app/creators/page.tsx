import Link from "next/link";

export const metadata = { title: "For podcast creators · Podcast Digest" };

const contact = process.env.CONTACT_EMAIL || process.env.ADMIN_EMAIL || "";

export default function CreatorsPage() {
  const mailto = contact
    ? `mailto:${contact}?subject=${encodeURIComponent("Please stop summarising my podcast")}&body=${encodeURIComponent("Podcast name:\nLink to the show:\nYour role on the show:\n")}`
    : null;

  return (
    <main className="mx-auto max-w-2xl px-6 py-12 leading-relaxed">
      <Link href="/" className="text-sm text-accent">
        ← Podcast Digest
      </Link>
      <h1 className="mt-4 text-2xl font-semibold">For podcast creators</h1>
      <div className="mt-6 space-y-4 text-[15px]">
        <p>
          Podcast Digest sends listeners short summaries of new episodes from shows they follow. Every
          summary credits your show and links to the full episode, and audio always plays from your own
          host, so your downloads are counted as normal. We only use publicly available episodes.
        </p>
        <p>
          If you&apos;d rather we didn&apos;t summarise your show, tell us and we&apos;ll stop and remove
          existing summaries as soon as we can.
        </p>
        {mailto && (
          <a href={mailto} className="inline-block rounded-full bg-accent px-5 py-2.5 font-medium text-white dark:text-black">
            Ask us to stop summarising my show
          </a>
        )}
        <p className="text-sm text-muted">
          Interested in official summaries of your show, or something else? Get in touch at the same address.
        </p>
      </div>
    </main>
  );
}
