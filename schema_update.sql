-- ============================================================
-- Schema Update Patch
-- Run this in Supabase SQL Editor IF you already ran schema.sql
-- and the tables already exist. Safe to run multiple times.
-- ============================================================

-- 1. Make vendor nullable (some entries have no vendor info)
alter table orders alter column vendor drop not null;

-- 2. Make date_ordered nullable (some historical entries lack date)
alter table orders alter column date_ordered drop not null;

-- 3. Make date_received nullable
alter table received alter column date_received drop not null;

-- 4. Allow qty_ordered = 0 (Acetic Acid free items etc.)
alter table orders drop constraint if exists orders_qty_ordered_check;
alter table orders add constraint orders_qty_ordered_check check (qty_ordered >= 0);

-- 5. Allow qty_received = 0
alter table received drop constraint if exists received_qty_received_check;
alter table received add constraint received_qty_received_check check (qty_received >= 0);

-- 6. Add lab field to testing table (FREEDOM, VANGUARD, etc.)
alter table testing add column if not exists lab text;

-- 7. Make vials_sent nullable in testing (unknown at time of send)
alter table testing alter column vials_sent drop not null;
alter table testing drop constraint if exists testing_vials_sent_check;
alter table testing add constraint testing_vials_sent_check check (vials_sent >= 0);

-- 8. Make date_sent nullable in testing
alter table testing alter column date_sent drop not null;

-- 9. Make approved_date nullable
alter table approved alter column approved_date drop not null;

-- 10. Make date_listed nullable in on_website
alter table on_website alter column date_listed drop not null;

-- 11. Default storage to 'shelf' for received and approved
alter table received alter column storage set default 'shelf';
alter table approved alter column storage set default 'shelf';

-- 12. Slack notification dedup log
create table if not exists slack_notification_log (
  sku        text primary key,
  notified   boolean not null default true,
  last_sent  timestamptz not null default now()
);

alter table slack_notification_log enable row level security;
create policy "allow all" on slack_notification_log for all using (true) with check (true);

-- 13. Enable pg_cron and pg_net for scheduled Slack daily summary
-- NOTE: pg_cron must be enabled in the Supabase Dashboard first:
--   Database > Extensions > search "pg_cron" > Enable
--   Database > Extensions > search "pg_net" > Enable
-- Then run the cron.schedule() call below in the SQL Editor.

-- create extension if not exists pg_cron;    -- enable via Dashboard
-- create extension if not exists pg_net;     -- enable via Dashboard

-- Daily Slack summary at 9:00 AM CDT (14:00 UTC)
-- Uncomment and run AFTER enabling pg_cron and deploying the slack-warehouse Edge Function:
--
-- select cron.schedule(
--   'daily-slack-summary',
--   '0 14 * * *',
--   $$
--   select net.http_post(
--     url := 'https://uxjgqwaeruustwnxplyy.supabase.co/functions/v1/slack-warehouse',
--     headers := '{"Content-Type": "application/json", "Authorization": "Bearer YOUR_ANON_KEY_HERE"}'::jsonb,
--     body := '{"event": "daily_summary", "data": {}}'::jsonb
--   );
--   $$
-- );

-- 14. Sales history table (WooCommerce order line items for forecasting)
create table if not exists sales_history (
  id              uuid primary key default uuid_generate_v4(),
  woo_order_id    bigint not null,
  order_date      timestamptz not null,
  order_status    text not null,
  sku             text not null,
  product_id      bigint,
  variation_id    bigint,
  product_name    text,
  quantity        integer not null,
  line_total      numeric(10, 2),
  created_at      timestamptz not null default now()
);

create unique index if not exists idx_sales_history_dedup
  on sales_history (woo_order_id, sku, coalesce(variation_id, 0));
create index if not exists idx_sales_history_sku_date on sales_history (sku, order_date desc);
create index if not exists idx_sales_history_order_date on sales_history (order_date desc);

alter table sales_history enable row level security;
do $$ begin
  create policy "allow all" on sales_history for all using (true) with check (true);
exception when duplicate_object then null;
end $$;

-- 15. Vendor lead times
create table if not exists vendor_lead_times (
  id              uuid primary key default uuid_generate_v4(),
  vendor_name     text not null,
  sku             text,
  lead_time_days  integer not null check (lead_time_days >= 0),
  is_domestic     boolean not null default false,
  notes           text,
  updated_by      text not null,
  updated_at      timestamptz not null default now(),
  created_at      timestamptz not null default now()
);

create unique index if not exists idx_vendor_lead_unique
  on vendor_lead_times (vendor_name, coalesce(sku, ''));

alter table vendor_lead_times enable row level security;
do $$ begin
  create policy "allow all" on vendor_lead_times for all using (true) with check (true);
exception when duplicate_object then null;
end $$;

-- 16. Sync metadata
create table if not exists sync_metadata (
  key        text primary key,
  value      text not null,
  updated_at timestamptz not null default now()
);

alter table sync_metadata enable row level security;
do $$ begin
  create policy "allow all" on sync_metadata for all using (true) with check (true);
exception when duplicate_object then null;
end $$;

-- 17. Forecast metrics function
create or replace function get_forecast_metrics()
returns jsonb language plpgsql as $$
declare result jsonb;
begin
  with daily_sales as (
    select sku, product_name, product_id, variation_id,
      date_trunc('day', order_date) as sale_date,
      sum(quantity) as daily_qty
    from sales_history
    where order_status in ('completed', 'delivered', 'processing')
    group by sku, product_name, product_id, variation_id, date_trunc('day', order_date)
  ),
  weekly_sales as (
    select sku,
      date_trunc('week', sale_date) as week_start,
      sum(daily_qty) as weekly_qty
    from daily_sales
    group by sku, date_trunc('week', sale_date)
  ),
  burn_rates as (
    select sku,
      max(product_name) as product_name,
      max(product_id)::bigint as product_id,
      max(variation_id)::bigint as variation_id,
      coalesce(sum(daily_qty) filter (where sale_date >= now() - interval '7 days'), 0) as sold_7d,
      coalesce(sum(daily_qty) filter (where sale_date >= now() - interval '14 days'), 0) as sold_14d,
      coalesce(sum(daily_qty) filter (where sale_date >= now() - interval '30 days'), 0) as sold_30d,
      coalesce(sum(daily_qty) filter (where sale_date >= now() - interval '60 days'), 0) as sold_60d,
      coalesce(sum(daily_qty) filter (where sale_date >= now() - interval '90 days'), 0) as sold_90d,
      coalesce(sum(daily_qty) filter (where sale_date >= now() - interval '180 days'), 0) as sold_180d,
      round(coalesce(sum(daily_qty) filter (where sale_date >= now() - interval '7 days'), 0) / 7.0, 2) as burn_7d,
      round(coalesce(sum(daily_qty) filter (where sale_date >= now() - interval '14 days'), 0) / 14.0, 2) as burn_14d,
      round(coalesce(sum(daily_qty) filter (where sale_date >= now() - interval '30 days'), 0) / 30.0, 2) as burn_30d,
      round(coalesce(sum(daily_qty) filter (where sale_date >= now() - interval '60 days'), 0) / 60.0, 2) as burn_60d,
      round(coalesce(sum(daily_qty) filter (where sale_date >= now() - interval '90 days'), 0) / 90.0, 2) as burn_90d,
      round(coalesce(sum(daily_qty) filter (where sale_date >= now() - interval '180 days'), 0) / 180.0, 2) as burn_180d,
      sum(daily_qty) as total_sold,
      min(sale_date)::text as first_sale,
      max(sale_date)::text as last_sale
    from daily_sales
    group by sku
  ),
  weekly_trends as (
    select sku,
      jsonb_agg(
        jsonb_build_object('week', week_start::text, 'qty', weekly_qty)
        order by week_start desc
      ) filter (where week_start >= now() - interval '12 weeks') as recent_weeks
    from weekly_sales
    group by sku
  )
  select jsonb_agg(
    to_jsonb(b) || jsonb_build_object('recent_weeks', coalesce(w.recent_weeks, '[]'::jsonb))
  ) into result
  from burn_rates b
  left join weekly_trends w on b.sku = w.sku;
  return coalesce(result, '[]'::jsonb);
end; $$;

-- 18. Realtime for new tables
alter publication supabase_realtime add table sales_history;
alter publication supabase_realtime add table vendor_lead_times;

-- 19. Users table for PIN authentication and roles
create extension if not exists pgcrypto;

create table if not exists users (
  id         uuid primary key default uuid_generate_v4(),
  username   text unique not null,
  pin_hash   text not null,
  role       text not null default 'viewer' check (role in ('admin', 'viewer')),
  created_at timestamptz not null default now()
);

alter table users enable row level security;
do $$ begin
  create policy "allow all" on users for all using (true) with check (true);
exception when duplicate_object then null;
end $$;

-- Seed initial users with placeholder PINs (change these!)
-- Camila: 1234, Admin: 0000, Aiden: 5678, Peyton: 9012
insert into users (username, pin_hash, role) values
  ('Camila', encode(digest('1234', 'sha256'), 'hex'), 'admin'),
  ('Admin',  encode(digest('0000', 'sha256'), 'hex'), 'admin'),
  ('Aiden',  encode(digest('5678', 'sha256'), 'hex'), 'viewer'),
  ('Peyton', encode(digest('9012', 'sha256'), 'hex'), 'viewer')
on conflict (username) do nothing;

-- Verify
select 'Schema update complete' as status;
