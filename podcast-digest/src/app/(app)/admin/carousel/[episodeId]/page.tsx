import Link from "next/link";
import { notFound } from "next/navigation";
import { getUser } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/env";
import { carouselCaption, getCarouselData } from "@/lib/carousel";

export const metadata = { title: "Carousel · Podcast Digest" };

export default async function CarouselPage({ params }: PageProps<"/admin/carousel/[episodeId]">) {
  const user = await getUser();
  if (!isAdminEmail(user?.email)) notFound();
  const { episodeId } = await params;
  const data = await getCarouselData(episodeId);
  if (!data) notFound();

  const slides = Array.from({ length: data.tips.length + 2 }, (_, i) => `/api/carousel/${episodeId}/${i}`);

  return (
    <div>
      <Link href="/admin" className="text-sm text-accent">
        ← Admin
      </Link>
      <h1 className="mt-3 text-xl font-semibold">{data.podcastTitle}</h1>
      <p className="text-sm text-muted">{data.episodeTitle}</p>

      <p className="mt-4 text-sm">
        {slides.length} slides. On your phone, tap and hold each image and choose <strong>Save to Photos</strong>, then
        post them together as a carousel. On a computer, click a slide to open it, then save it.
      </p>
      <ul className="-mx-4 mt-3 flex snap-x gap-3 overflow-x-auto px-4 pb-3">
        {slides.map((src, i) => (
          <li key={src} className="w-56 shrink-0 snap-start">
            <a href={src} target="_blank" rel="noreferrer">
              {/* eslint-disable-next-line @next/next/no-img-element -- generated PNG, shown as-is */}
              <img src={src} alt={`Slide ${i + 1}`} width={224} height={280} className="rounded-xl border border-border" />
            </a>
            <p className="mt-1 text-center text-xs text-muted">Slide {i + 1}</p>
          </li>
        ))}
      </ul>

      <h2 className="mt-6 font-semibold">Caption</h2>
      <p className="text-xs text-muted">Tap in the box, select all, copy.</p>
      <textarea
        readOnly
        defaultValue={carouselCaption(data)}
        rows={14}
        className="mt-2 w-full rounded-xl border border-border bg-surface p-3 text-sm"
      />
      <p className="mt-2 text-xs text-muted">
        Put <code>podcast-digest-six.vercel.app/?ref=instagram</code> in your bio so sign-ups from Instagram show up in
        Admin.
      </p>
    </div>
  );
}
