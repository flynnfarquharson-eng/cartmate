-- Podcast Digest: discovery (interests, recommendations, Apple Podcasts ids)
-- Paste this whole file into Supabase > SQL Editor > New query, then click "Run".
-- It is safe to run more than once.

-- Apple Podcasts id, so search results and share links match shows we already have.
alter table public.podcasts add column if not exists itunes_id bigint;
create index if not exists podcasts_itunes_idx on public.podcasts (itunes_id);

-- What each person is into, from the welcome screen.
create table if not exists public.user_preferences (
  user_id          uuid primary key references auth.users(id) on delete cascade,
  interests        text[] not null default '{}',
  favourite_shows  text[] not null default '{}',
  updated_at       timestamptz not null default now()
);

-- Every show we suggested, where the suggestion came from, and whether they followed it.
-- Lets us measure which kind of recommendation actually works.
create table if not exists public.recommendations (
  user_id      uuid not null references auth.users(id) on delete cascade,
  itunes_id    bigint not null,
  source       text not null check (source in ('claude', 'friends', 'chart', 'search', 'link')),
  title        text not null,
  author       text,
  image_url    text,
  reason       text,
  position     integer,
  shown_at     timestamptz not null default now(),
  followed_at  timestamptz,
  primary key (user_id, itunes_id, source)
);
create index if not exists recommendations_user_source_idx on public.recommendations (user_id, source);

alter table public.user_preferences enable row level security;
alter table public.recommendations  enable row level security;

drop policy if exists "own preferences" on public.user_preferences;
create policy "own preferences" on public.user_preferences
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "own recommendations" on public.recommendations;
create policy "own recommendations" on public.recommendations
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
