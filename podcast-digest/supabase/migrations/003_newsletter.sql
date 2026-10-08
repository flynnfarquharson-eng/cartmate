-- Podcast Digest: newsletter (subscriptions, sends, creator opt-outs)
-- Paste this whole file into Supabase > SQL Editor > New query, then click "Run".
-- It is safe to run more than once.

-- One row per person who gets the email digest.
create table if not exists public.newsletter_subscriptions (
  user_id            uuid primary key references auth.users(id) on delete cascade,
  frequency          text not null default 'weekly' check (frequency in ('weekly', 'daily', 'off')),
  -- Secret used in unsubscribe links, so unsubscribing works without logging in.
  unsubscribe_token  uuid not null unique default gen_random_uuid(),
  -- Where and when they agreed to receive it (Spam Act: keep a record of consent).
  consent_source     text not null default 'signup',
  consented_at       timestamptz not null default now(),
  last_sent_at       timestamptz,
  updated_at         timestamptz not null default now()
);

-- Every digest we send, and which episodes were in it, so nobody gets the same episode twice.
create table if not exists public.digest_sends (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  sent_at      timestamptz not null default now(),
  episode_ids  uuid[] not null default '{}',
  provider_id  text,
  error        text
);
create index if not exists digest_sends_user_idx on public.digest_sends (user_id, sent_at desc);

-- Shows whose creators asked us not to summarise them. They're skipped everywhere.
create table if not exists public.creator_optouts (
  podcast_id    uuid primary key references public.podcasts(id) on delete cascade,
  requested_at  timestamptz not null default now(),
  note          text
);

alter table public.newsletter_subscriptions enable row level security;
alter table public.digest_sends             enable row level security;
alter table public.creator_optouts          enable row level security;

-- You can see and change your own subscription. Creating rows and unsubscribing
-- by link happen on the server.
drop policy if exists "own subscription read" on public.newsletter_subscriptions;
create policy "own subscription read" on public.newsletter_subscriptions
  for select to authenticated using (user_id = auth.uid());
drop policy if exists "own subscription update" on public.newsletter_subscriptions;
create policy "own subscription update" on public.newsletter_subscriptions
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "own sends read" on public.digest_sends;
create policy "own sends read" on public.digest_sends
  for select to authenticated using (user_id = auth.uid());

-- (creator_optouts: no policies = server only)
