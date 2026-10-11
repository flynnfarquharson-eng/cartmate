-- Podcast Digest: sign-up attribution and product test events
-- Paste this whole file into Supabase > SQL Editor > New query, then click "Run".
-- It is safe to run more than once.

-- Where each person came from when they signed up (e.g. ?ref=instagram).
create table if not exists public.signup_sources (
  user_id       uuid primary key references auth.users(id) on delete cascade,
  ref           text,
  utm_source    text,
  utm_medium    text,
  utm_campaign  text,
  landing_path  text,
  created_at    timestamptz not null default now()
);

-- Clicks on test buttons ("App Store coming soon", "Founding member") and similar.
-- Visitors who aren't logged in are counted with an anonymous id.
create table if not exists public.product_events (
  id          bigint generated always as identity primary key,
  event       text not null,
  user_id     uuid references auth.users(id) on delete set null,
  anon_id     text,
  ref         text,
  props       jsonb not null default '{}',
  created_at  timestamptz not null default now()
);
create index if not exists product_events_event_idx on public.product_events (event, created_at desc);

-- Both tables are written and read only by the server.
alter table public.signup_sources enable row level security;
alter table public.product_events enable row level security;
