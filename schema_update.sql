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

-- Verify
select 'Schema update complete' as status;
