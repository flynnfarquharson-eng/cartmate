# Podcast Digest

Follow podcasts, get AI summaries of new episodes, and keep the best tips in a searchable library.

Built with Next.js 16, Supabase, Podcast Index, Deepgram and Claude.

**Key rule:** each episode is processed once and shared by everyone who follows the show, so costs grow with the number of shows, not users.

## Status

- [x] **Phase 1** – login, podcast search, follow/unfollow, RSS polling that saves new episodes
- [x] **Phase 2** – transcription + summarisation pipeline (needs `ANTHROPIC_API_KEY` + `DEEPGRAM_API_KEY`)
- [x] **Phase 3** – feed of summaries, episode pages with tap-to-play timestamps, searchable tips library with saving
- [ ] Phase 4 – admin page, deployment to Vercel, hourly cron

## Setup (Phase 1)

You need Node.js 20 or newer (`node -v` to check; install from https://nodejs.org).

### 1. Create a Supabase project
1. Sign up at https://supabase.com and click **New project**. Pick any name, a strong database password, and the region closest to you. Wait ~2 minutes for it to start.
2. Open **SQL Editor** (left sidebar) → **New query**. Paste the whole contents of `supabase/migrations/001_initial_schema.sql` and click **Run**. You should see "Success. No rows returned".
3. Open **Authentication → URL Configuration**:
   - **Site URL**: `http://localhost:3000`
   - **Redirect URLs**: add `http://localhost:3000/**`
4. Open **Project Settings → API Keys** and copy the **Publishable key** and the **Secret key**. Your **Project URL** is under **Project Settings → Data API** (looks like `https://abcd1234.supabase.co`).

> Supabase's built-in email sender only allows a few login emails per hour. That's fine for testing. Before launching to real users we'll connect a proper email service (Phase 4).

### 2. Get a Podcast Index API key
Sign up (free) at https://api.podcastindex.org/signup. The key and secret are emailed to you.

### 3. Configure and run
From this `podcast-digest` folder:

```bash
cp .env.example .env.local      # then open .env.local and paste your keys
npm install
npm run dev
```

Open http://localhost:3000.

## How it works (Phase 1)

- **Follow a show** → the show is saved once in `podcasts` (shared by all users) and its 3 most recent episodes are imported as `pending`. Older back-catalogue episodes are skipped so we never pay to summarise hundreds of old episodes.
- **Feed check** (`/api/cron/poll-feeds`) → downloads the RSS feed of every show that at least one person follows and saves new episodes as `pending`. It skips feeds that haven't changed, and the database rejects duplicate episodes, so it's safe to run as often as you like.
- **Transcripts are private**: they live in a table that the browser can't read at all.

## How it works (Phase 2)

- **Summarise** (`/api/cron/process-episodes`) → takes the next 2 `pending` episodes from shows someone follows and runs each one through:
  1. **Transcript**: uses the show's own transcript if the feed publishes one (free). Otherwise Deepgram transcribes the audio (about US$0.26 per hour of audio).
  2. **Summary**: Claude writes an overview, key ideas, quotes with timestamps, resources mentioned and practical tips (roughly US$0.10-0.20 per hour-long episode).
- **Never paid for twice**: each run claims an episode with an atomic update, so two runs can't process the same one. If summarising fails, the retry reuses the saved transcript instead of paying Deepgram again.
- **Retries**: failed episodes are retried up to 3 times in total. Episodes stuck "in progress" for 15 minutes (e.g. a crashed run) are picked up again.
- **Cost guard**: episodes longer than 4 hours are skipped.
- Admins can trigger it from **Settings → Summarise next pending episodes**.

## Discovery

- **Welcome screen** (`/welcome`): interests plus up to 3 favourite shows, saved in `user_preferences`.
- **Discover** (`/discover`): one search box that also accepts Apple Podcasts / Spotify show or episode links, then:
  - **Picked for you**: Claude suggests shows, and each one is checked against Apple Podcasts (real name match, episode in the last 120 days) before it's shown. Generated once per set of preferences.
  - **Popular with friends**: shows other users follow (already summarised, so free to add).
  - **Top in Australia**: Apple's AU top charts for each interest.
- **Preview** (`/podcast/[itunesId]`): show details, latest episodes and a sample summary if one exists.
- Search, charts and verification use Apple's free directory (better ranking than Podcast Index). Podcast Index still supplies the RSS feed when someone follows.
- Every suggestion shown and followed is logged in `recommendations`, and the admin section of Settings shows follow rates by source.
- Needs `supabase/migrations/002_discovery.sql`.
