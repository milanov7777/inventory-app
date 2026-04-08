-- ============================================================
-- Inventory Tracking App — Supabase Schema
-- Run this entire file in the Supabase SQL Editor (once).
-- If tables already exist, use schema_update.sql instead.
-- ============================================================

-- EXTENSIONS
create extension if not exists "uuid-ossp";

-- ============================================================
-- ENUM TYPES
-- ============================================================
create type order_status as enum (
  'ordered', 'received', 'in_testing', 'approved', 'live', 'failed'
);

create type storage_location as enum ('fridge', 'shelf');

create type pass_fail_result as enum ('pass', 'fail');

create type coa_status as enum ('yes', 'no');

-- ============================================================
-- TABLE: orders  (Stage 1)
-- vendor and date_ordered are nullable — some historical records
-- and received-only entries don't have this info.
-- ============================================================
create table orders (
  id              uuid primary key default uuid_generate_v4(),
  sku             text not null,
  compound_mg     text not null,
  qty_ordered     integer not null check (qty_ordered >= 0),
  batch_number    text unique not null,
  vendor          text,                          -- nullable: some entries have no vendor
  unit_price      numeric(10, 2) not null default 0 check (unit_price >= 0),
  date_ordered    date,                          -- nullable: some historical entries lack date
  tracking_number text,
  shipping_cost   numeric(10, 2) not null default 0 check (shipping_cost >= 0),
  total_value     numeric(10, 2) generated always as
                    (qty_ordered * unit_price + shipping_cost) stored,
  logged_by       text not null,
  notes           text,
  status          order_status not null default 'ordered',
  created_at      timestamptz not null default now()
);

-- ============================================================
-- TABLE: received  (Stage 2)
-- ============================================================
create table received (
  id            uuid primary key default uuid_generate_v4(),
  batch_number  text not null references orders(batch_number)
                  on update cascade on delete restrict,
  sku           text not null,
  compound_mg   text not null,
  qty_received  integer not null check (qty_received >= 0),
  date_received date,
  storage       storage_location not null default 'shelf',
  cap_color     text,
  logged_by     text not null,
  notes         text,
  created_at    timestamptz not null default now()
);

-- ============================================================
-- TABLE: testing  (Stage 3)
-- lab field added: FREEDOM, VANGUARD, etc.
-- vials_sent made nullable (some batches have unknown qty at time of send)
-- ============================================================
create table testing (
  id                    uuid primary key default uuid_generate_v4(),
  batch_number          text not null references orders(batch_number)
                          on update cascade on delete restrict,
  sku                   text not null,
  compound_mg           text not null,
  lab                   text,                    -- testing lab name e.g. FREEDOM, VANGUARD
  vials_sent            integer check (vials_sent >= 0),
  date_sent             date,
  date_results_received date,
  pass_fail             pass_fail_result,
  coa_on_file           coa_status not null default 'no',
  logged_by             text not null,
  notes                 text,
  created_at            timestamptz not null default now()
);

-- ============================================================
-- TABLE: approved  (Stage 4)
-- ============================================================
create table approved (
  id            uuid primary key default uuid_generate_v4(),
  batch_number  text not null references orders(batch_number)
                  on update cascade on delete restrict,
  sku           text not null,
  compound_mg   text not null,
  qty_available integer not null check (qty_available >= 0),
  approved_date date,
  storage       storage_location not null default 'shelf',
  logged_by     text not null,
  notes         text,
  created_at    timestamptz not null default now()
);

-- ============================================================
-- TABLE: on_website  (Stage 5)
-- ============================================================
create table on_website (
  id            uuid primary key default uuid_generate_v4(),
  batch_number  text not null references orders(batch_number)
                  on update cascade on delete restrict,
  sku           text not null,
  compound_mg   text not null,
  qty_listed    integer not null check (qty_listed >= 0),
  date_listed   date,
  price_listed  numeric(10, 2) not null default 0 check (price_listed >= 0),
  notes         text,
  created_at    timestamptz not null default now()
);

-- ============================================================
-- TABLE: audit_log
-- ============================================================
create table audit_log (
  id           uuid primary key default uuid_generate_v4(),
  timestamp    timestamptz not null default now(),
  user_name    text not null,
  action_type  text not null,   -- 'create' | 'update' | 'delete' | 'promote'
  batch_number text,
  stage        text,
  changes_json jsonb,
  created_at   timestamptz not null default now()
);

-- ============================================================
-- TABLE: sku_thresholds  (Admin reorder points)
-- ============================================================
create table sku_thresholds (
  sku               text primary key,
  reorder_threshold integer not null check (reorder_threshold >= 0),
  updated_by        text not null,
  updated_at        timestamptz not null default now()
);

-- ============================================================
-- VIEW: sku_qty_summary
-- ============================================================
create view sku_qty_summary as
  select sku, sum(qty_available) as total_qty
  from approved
  group by sku;

-- ============================================================
-- INDEXES
-- ============================================================
create index idx_orders_batch        on orders(batch_number);
create index idx_orders_status       on orders(status);
create index idx_orders_vendor       on orders(vendor);
create index idx_received_batch      on received(batch_number);
create index idx_testing_batch       on testing(batch_number);
create index idx_approved_batch      on approved(batch_number);
create index idx_on_website_batch    on on_website(batch_number);
create index idx_audit_log_timestamp on audit_log(timestamp desc);
create index idx_audit_log_batch     on audit_log(batch_number);
create index idx_audit_log_user      on audit_log(user_name);

-- ============================================================
-- ROW LEVEL SECURITY — permissive (anon key, no password auth)
-- ============================================================
alter table orders         enable row level security;
alter table received       enable row level security;
alter table testing        enable row level security;
alter table approved       enable row level security;
alter table on_website     enable row level security;
alter table audit_log      enable row level security;
alter table sku_thresholds enable row level security;

create policy "allow all" on orders         for all using (true) with check (true);
create policy "allow all" on received       for all using (true) with check (true);
create policy "allow all" on testing        for all using (true) with check (true);
create policy "allow all" on approved       for all using (true) with check (true);
create policy "allow all" on on_website     for all using (true) with check (true);
create policy "allow all" on audit_log      for all using (true) with check (true);
create policy "allow all" on sku_thresholds for all using (true) with check (true);

-- ============================================================
-- TABLE: slack_notification_log  (dedup for Slack alerts)
-- ============================================================
create table slack_notification_log (
  sku        text primary key,
  notified   boolean not null default true,
  last_sent  timestamptz not null default now()
);

alter table slack_notification_log enable row level security;
create policy "allow all" on slack_notification_log for all using (true) with check (true);

-- ============================================================
-- TABLE: sales_history  (WooCommerce order line items)
-- ============================================================
create table sales_history (
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

create unique index idx_sales_history_dedup
  on sales_history (woo_order_id, sku, coalesce(variation_id, 0));
create index idx_sales_history_sku_date on sales_history (sku, order_date desc);
create index idx_sales_history_order_date on sales_history (order_date desc);

alter table sales_history enable row level security;
create policy "allow all" on sales_history for all using (true) with check (true);

-- ============================================================
-- TABLE: vendor_lead_times
-- ============================================================
create table vendor_lead_times (
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

create unique index idx_vendor_lead_unique
  on vendor_lead_times (vendor_name, coalesce(sku, ''));

alter table vendor_lead_times enable row level security;
create policy "allow all" on vendor_lead_times for all using (true) with check (true);

-- ============================================================
-- TABLE: sync_metadata
-- ============================================================
create table sync_metadata (
  key        text primary key,
  value      text not null,
  updated_at timestamptz not null default now()
);

alter table sync_metadata enable row level security;
create policy "allow all" on sync_metadata for all using (true) with check (true);

-- ============================================================
-- FUNCTION: get_forecast_metrics
-- ============================================================
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

-- ============================================================
-- REALTIME
-- ============================================================
alter publication supabase_realtime add table orders;
alter publication supabase_realtime add table received;
alter publication supabase_realtime add table testing;
alter publication supabase_realtime add table approved;
alter publication supabase_realtime add table on_website;
alter publication supabase_realtime add table audit_log;
alter publication supabase_realtime add table sales_history;
alter publication supabase_realtime add table vendor_lead_times;

-- ============================================================
-- SCHEDULED JOBS (pg_cron + pg_net)
-- ============================================================
-- Daily Slack summary at 9:00 AM CDT (14:00 UTC).
-- Requires pg_cron and pg_net extensions enabled via Supabase Dashboard.
-- Also requires the slack-warehouse Edge Function to be deployed.
-- See schema_update.sql for the cron.schedule() command.
