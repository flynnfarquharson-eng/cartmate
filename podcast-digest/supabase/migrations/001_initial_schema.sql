-- Podcast Digest: initial schema (Phase 1)
-- Paste this whole file into Supabase > SQL Editor > New query, then click "Run".
-- It is safe to run more than once.

-- ─────────────────────────────────────────────────────────────
-- Shared content (one row per show / episode, shared by ALL users)
-- ─────────────────────────────────────────────────────────────

create table if not exists public.podcasts (
  id                 uuid primary key default gen_random_uuid(),
  podcast_index_id   bigint not null unique,
  title              text not null,
  author             text,
  description        text,
  image_url          text,
  rss_url            text not null,
  website_url        text,
  -- Only episodes published on/after this date are imported, so following
  -- a show with 500 old episodes doesn't queue 500 summaries.
  import_after       timestamptz,
  -- Lets us skip re-downloading feeds that haven't changed.
  feed_etag          text,
  feed_last_modified text,
  last_checked_at    timestamptz,
  last_check_error   text,
  created_at         timestamptz not null default now()
);

do $$ begin
  create type public.episode_status as enum
    ('pending', 'transcribing', 'summarising', 'done', 'failed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.transcript_source as enum ('feed', 'deepgram');
exception when duplicate_object then null; end $$;

create table if not exists public.episodes (
  id                 uuid primary key default gen_random_uuid(),
  podcast_id         uuid not null references public.podcasts(id) on delete cascade,
  guid               text not null,
  title              text not null,
  description        text,
  episode_url        text,           -- link back to the original episode page
  published_at       timestamptz,
  audio_url          text,
  duration_seconds   integer,
  -- Podcasting 2.0 <podcast:transcript> tag, if the feed provides one
  feed_transcript_url  text,
  feed_transcript_type text,
  transcript_source  public.transcript_source,
  status             public.episode_status not null default 'pending',
  error              text,
  attempts           integer not null default 0,
  processing_started_at timestamptz,
  processed_at       timestamptz,
  created_at         timestamptz not null default now(),
  -- Guarantees the same episode can never be stored (or processed) twice
  unique (podcast_id, guid)
);

create index if not exists episodes_podcast_published_idx
  on public.episodes (podcast_id, published_at desc);
create index if not exists episodes_status_idx on public.episodes (status);

-- Transcripts live in their own table with NO user access at all.
-- Only the server (secret key) can read them, so a full transcript can never
-- leak to the browser.
create table if not exists public.episode_transcripts (
  episode_id  uuid primary key references public.episodes(id) on delete cascade,
  source      public.transcript_source not null,
  text        text not null,
  segments    jsonb,                 -- [{start, end, text}] when timestamps are known
  created_at  timestamptz not null default now()
);

create table if not exists public.summaries (
  id                     uuid primary key default gen_random_uuid(),
  episode_id             uuid not null unique references public.episodes(id) on delete cascade,
  overview               text not null,
  key_ideas              jsonb not null default '[]',
  quotes_with_timestamps jsonb not null default '[]',
  resources_mentioned    jsonb not null default '[]',
  created_at             timestamptz not null default now()
);

create table if not exists public.tips (
  id                 uuid primary key default gen_random_uuid(),
  episode_id         uuid not null references public.episodes(id) on delete cascade,
  tip_text           text not null,
  category           text,
  timestamp_seconds  integer,
  created_at         timestamptz not null default now()
);
create index if not exists tips_episode_idx on public.tips (episode_id);

-- ─────────────────────────────────────────────────────────────
-- Per-user data
-- ─────────────────────────────────────────────────────────────

create table if not exists public.user_follows (
  user_id     uuid not null references auth.users(id) on delete cascade,
  podcast_id  uuid not null references public.podcasts(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (user_id, podcast_id)
);
create index if not exists user_follows_podcast_idx on public.user_follows (podcast_id);

create table if not exists public.saved_tips (
  user_id     uuid not null references auth.users(id) on delete cascade,
  tip_id      uuid not null references public.tips(id) on delete cascade,
  user_tags   text[] not null default '{}',
  created_at  timestamptz not null default now(),
  primary key (user_id, tip_id)
);

-- ─────────────────────────────────────────────────────────────
-- Row Level Security
-- Shared content: any logged-in user can read; only the server can write.
-- Per-user data: you can only see and change your own rows.
-- ─────────────────────────────────────────────────────────────

alter table public.podcasts            enable row level security;
alter table public.episodes            enable row level security;
alter table public.episode_transcripts enable row level security;
alter table public.summaries           enable row level security;
alter table public.tips                enable row level security;
alter table public.user_follows        enable row level security;
alter table public.saved_tips          enable row level security;

drop policy if exists "read podcasts" on public.podcasts;
create policy "read podcasts" on public.podcasts
  for select to authenticated using (true);

drop policy if exists "read episodes" on public.episodes;
create policy "read episodes" on public.episodes
  for select to authenticated using (true);

drop policy if exists "read summaries" on public.summaries;
create policy "read summaries" on public.summaries
  for select to authenticated using (true);

drop policy if exists "read tips" on public.tips;
create policy "read tips" on public.tips
  for select to authenticated using (true);

-- (episode_transcripts intentionally has no policies = no user access)

drop policy if exists "own follows" on public.user_follows;
create policy "own follows" on public.user_follows
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "own saved tips" on public.saved_tips;
create policy "own saved tips" on public.saved_tips
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
