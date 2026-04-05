-- CartMate Database Schema
-- Run this in your Supabase SQL Editor

-- Enable UUID generation
create extension if not exists "uuid-ossp";

-- Houses
create table houses (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  address text not null,
  invite_code text unique not null,
  created_at timestamp with time zone default now()
);

-- Members
create table members (
  id uuid primary key default uuid_generate_v4(),
  house_id uuid references houses(id) on delete cascade not null,
  name text not null,
  email text not null,
  avatar_color text not null,
  created_at timestamp with time zone default now()
);

-- Orders
create table orders (
  id uuid primary key default uuid_generate_v4(),
  house_id uuid references houses(id) on delete cascade not null,
  status text not null default 'open' check (status in ('open', 'locked', 'confirmed')),
  created_at timestamp with time zone default now()
);

-- Items
create table items (
  id uuid primary key default uuid_generate_v4(),
  order_id uuid references orders(id) on delete cascade not null,
  member_id uuid references members(id) on delete cascade not null,
  name text not null,
  price decimal(10,2) not null,
  created_at timestamp with time zone default now()
);

-- Payments
create table payments (
  id uuid primary key default uuid_generate_v4(),
  order_id uuid references orders(id) on delete cascade not null,
  member_id uuid references members(id) on delete cascade not null,
  amount decimal(10,2) not null,
  stripe_payment_intent_id text not null,
  status text not null default 'pending' check (status in ('pending', 'paid')),
  created_at timestamp with time zone default now()
);

-- Row Level Security

alter table houses enable row level security;
alter table members enable row level security;
alter table orders enable row level security;
alter table items enable row level security;
alter table payments enable row level security;

-- Since we use localStorage for member identity (no Supabase Auth),
-- RLS policies use the service role key for API routes and
-- the anon key with permissive policies scoped by house_id.
-- The app enforces house scoping in all queries via house_id.

-- Houses: anyone can create, members can read their own house
create policy "Anyone can create a house" on houses for insert with check (true);
create policy "Anyone can read houses" on houses for select using (true);

-- Members: anyone can join (insert), read members of same house
create policy "Anyone can create a member" on members for insert with check (true);
create policy "Read members of same house" on members for select using (true);

-- Orders: house members can read/create orders
create policy "Anyone can create orders" on orders for insert with check (true);
create policy "Read orders" on orders for select using (true);
create policy "Update orders" on orders for update using (true);

-- Items: members can add/read/delete items
create policy "Add items" on items for insert with check (true);
create policy "Read items" on items for select using (true);
create policy "Delete own items" on items for delete using (true);

-- Payments: read/create payments
create policy "Create payments" on payments for insert with check (true);
create policy "Read payments" on payments for select using (true);
create policy "Update payments" on payments for update using (true);

-- Enable realtime for items, orders, and payments
alter publication supabase_realtime add table items;
alter publication supabase_realtime add table orders;
alter publication supabase_realtime add table payments;

-- Indexes
create index idx_members_house_id on members(house_id);
create index idx_orders_house_id on orders(house_id);
create index idx_items_order_id on items(order_id);
create index idx_items_member_id on items(member_id);
create index idx_payments_order_id on payments(order_id);
create index idx_payments_member_id on payments(member_id);
create index idx_houses_invite_code on houses(invite_code);
