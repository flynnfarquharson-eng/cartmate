import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/env";
import { PodcastArt } from "@/components/PodcastArt";
import { UnfollowButton } from "@/components/FollowButton";
import { timeAgo } from "@/lib/format";
import { RecommendationStats } from "@/components/RecommendationStats";
import { DigestSettings } from "@/components/DigestSettings";
import { AppSettings } from "@/components/AppSettings";

export const metadata = { title: "Settings · Podcast Digest" };

type FollowRow = {
  podcast_id: string;
  podcasts: {
    title: string;
    author: string | null;
    image_url: string | null;
    last_checked_at: string | null;
    last_check_error: string | null;
  } | null;
};

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data } = await supabase
    .from("user_follows")
    .select("podcast_id, podcasts(title, author, image_url, last_checked_at, last_check_error)")
    .order("created_at", { ascending: false });
  const follows = (data ?? []) as unknown as FollowRow[];
  const { data: subscription } = await supabase
    .from("newsletter_subscriptions")
    .select("frequency")
    .maybeSingle();

  return (
    <div className="space-y-8">
      <section>
        <h1 className="mb-4 text-2xl font-semibold tracking-tight">Settings</h1>
        <Link
          href="/welcome"
          className="mb-3 flex items-center justify-between rounded-2xl border border-border bg-surface p-4"
        >
          <span>Your interests</span>
          <span className="text-sm text-accent">Edit →</span>
        </Link>
        <div className="rounded-2xl border border-border bg-surface p-4">
          <p className="text-sm text-muted">Logged in as</p>
          <p className="font-medium">{user?.email}</p>
          <form action="/auth/signout" method="post" className="mt-3">
            <button className="text-sm text-accent">Log out</button>
          </form>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">App</h2>
        <AppSettings />
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Email digest</h2>
        <DigestSettings frequency={(subscription?.frequency as "weekly" | "daily" | "off") ?? "weekly"} />
      </section>

      <section>
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-lg font-semibold">Shows you follow ({follows.length})</h2>
          <Link href="/discover" className="text-sm text-accent">
            + Add
          </Link>
        </div>
        {follows.length === 0 ? (
          <p className="text-sm text-muted">You&apos;re not following any shows yet.</p>
        ) : (
          <ul className="space-y-2">
            {follows.map((f) => (
              <li
                key={f.podcast_id}
                className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-3"
              >
                <PodcastArt src={f.podcasts?.image_url} alt={f.podcasts?.title ?? ""} size={48} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{f.podcasts?.title}</p>
                  <p className="truncate text-xs text-muted">
                    {f.podcasts?.last_checked_at
                      ? `Checked ${timeAgo(f.podcasts.last_checked_at)}`
                      : "Not checked yet"}
                  </p>
                  {f.podcasts?.last_check_error && (
                    <p className="truncate text-xs text-red-600">
                      Feed error: {f.podcasts.last_check_error}
                    </p>
                  )}
                </div>
                <UnfollowButton podcastId={f.podcast_id} title={f.podcasts?.title ?? "this show"} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {isAdminEmail(user?.email) && (
        <section>
          <h2 className="mb-3 text-lg font-semibold">Admin</h2>
          <a
            href="/api/cron/poll-feeds"
            target="_blank"
            className="inline-block rounded-full border border-border bg-surface px-4 py-2 text-sm"
          >
            Check all feeds for new episodes now
          </a>
          <a
            href="/api/cron/process-episodes"
            target="_blank"
            className="ml-2 inline-block rounded-full border border-border bg-surface px-4 py-2 text-sm"
          >
            Summarise next pending episodes
          </a>
          <a
            href="/api/cron/send-digests"
            target="_blank"
            className="ml-2 mt-2 inline-block rounded-full border border-border bg-surface px-4 py-2 text-sm"
          >
            Send due digests now
          </a>
          <p className="mt-2 text-xs text-muted">
            Summarising does 2 episodes per click and can take a few minutes. It costs money
            (Deepgram + Claude) unless the show publishes its own transcript.
          </p>
          <h3 className="mb-2 mt-6 font-semibold">Which suggestions work</h3>
          <RecommendationStats />
        </section>
      )}
    </div>
  );
}
