-- Run this in Supabase SQL Editor to add store selection to houses
alter table houses add column store_chain text;
alter table houses add column store_name text;
alter table houses add column store_no text;
