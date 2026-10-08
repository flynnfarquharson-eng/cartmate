import Link from "next/link";

export const metadata = { title: "Privacy · Podcast Digest" };

const contact = process.env.CONTACT_EMAIL || process.env.ADMIN_EMAIL || "";

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-12 leading-relaxed">
      <Link href="/" className="text-sm text-accent">
        ← Podcast Digest
      </Link>
      <h1 className="mt-4 text-2xl font-semibold">Privacy</h1>
      <p className="mt-1 text-sm text-muted">Last updated 8 October 2026</p>

      <div className="mt-6 space-y-4 text-[15px]">
        <p>
          Podcast Digest is run by Flynn Farquharson in Sydney, Australia. This page explains what we
          collect and why. In short: only what we need to send you summaries, and we never sell or share it.
        </p>
        <h2 className="pt-2 font-semibold">What we collect</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>Your email address, to log you in and send the digest.</li>
          <li>The shows you follow, the interests and favourite shows you tell us, and the tips you save.</li>
          <li>Which suggested shows you followed, so we can improve recommendations.</li>
          <li>When we sent you each digest, so you don&apos;t get the same episode twice.</li>
        </ul>
        <h2 className="pt-2 font-semibold">Who processes it</h2>
        <p>
          Data is stored with Supabase (servers in Japan) and the site is hosted by Vercel. Emails are sent
          through Resend. Your interests and favourite shows, without your email, are sent to Anthropic&apos;s
          Claude to suggest podcasts. Podcast audio is transcribed by Deepgram. We use these services only to
          run Podcast Digest.
        </p>
        <h2 className="pt-2 font-semibold">Your choices</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>Unsubscribe from the digest with one click from any email, or in Settings.</li>
          <li>
            Ask us to see or delete your data at any time{contact ? <> by emailing <a href={`mailto:${contact}`} className="text-accent">{contact}</a></> : ""}.
          </li>
        </ul>
        <h2 className="pt-2 font-semibold">About the summaries</h2>
        <p>
          Summaries are written by AI from each show&apos;s publicly available episodes and always link back
          to the original. They can contain mistakes. Podcast creators can{" "}
          <Link href="/creators" className="text-accent">
            ask us to stop summarising their show
          </Link>
          .
        </p>
      </div>
    </main>
  );
}
