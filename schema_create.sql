create extension if not exists "uuid-ossp";

create type order_status as enum ('ordered', 'received', 'in_testing', 'approved', 'live', 'failed');
create type storage_location as enum ('fridge', 'shelf');
create type pass_fail_result as enum ('pass', 'fail');
create type coa_status as enum ('yes', 'no');

create table orders (
  id uuid primary key default uuid_generate_v4(),
  sku text not null,
  compound_mg text not null,
  qty_ordered integer not null check (qty_ordered >= 0),
  batch_number text unique not null,
  vendor text,
  unit_price numeric(10,2) not null default 0 check (unit_price >= 0),
  date_ordered date,
  tracking_number text,
  shipping_cost numeric(10,2) not null default 0 check (shipping_cost >= 0),
  total_value numeric(10,2) generated always as (qty_ordered * unit_price + shipping_cost) stored,
  logged_by text not null,
  notes text,
  status order_status not null default 'ordered',
  created_at timestamptz not null default now()
);

create table received (
  id uuid primary key default uuid_generate_v4(),
  batch_number text not null references orders(batch_number) on update cascade on delete restrict,
  sku text not null,
  compound_mg text not null,
  qty_received integer not null check (qty_received >= 0),
  date_received date,
  storage storage_location not null default 'shelf',
  cap_color text,
  logged_by text not null,
  notes text,
  created_at timestamptz not null default now()
);

create table testing (
  id uuid primary key default uuid_generate_v4(),
  batch_number text not null references orders(batch_number) on update cascade on delete restrict,
  sku text not null,
  compound_mg text not null,
  lab text,
  vials_sent integer check (vials_sent >= 0),
  date_sent date,
  date_results_received date,
  pass_fail pass_fail_result,
  coa_on_file coa_status not null default 'no',
  logged_by text not null,
  notes text,
  created_at timestamptz not null default now()
);

create table approved (
  id uuid primary key default uuid_generate_v4(),
  batch_number text not null references orders(batch_number) on update cascade on delete restrict,
  sku text not null,
  compound_mg text not null,
  qty_available integer not null check (qty_available >= 0),
  approved_date date,
  storage storage_location not null default 'shelf',
  logged_by text not null,
  notes text,
  created_at timestamptz not null default now()
);

create table on_website (
  id uuid primary key default uuid_generate_v4(),
  batch_number text not null references orders(batch_number) on update cascade on delete restrict,
  sku text not null,
  compound_mg text not null,
  qty_listed integer not null check (qty_listed >= 0),
  date_listed date,
  price_listed numeric(10,2) not null default 0 check (price_listed >= 0),
  notes text,
  created_at timestamptz not null default now()
);

create table audit_log (
  id uuid primary key default uuid_generate_v4(),
  timestamp timestamptz not null default now(),
  user_name text not null,
  action_type text not null,
  batch_number text,
  stage text,
  changes_json jsonb,
  created_at timestamptz not null default now()
);

create table sku_thresholds (
  sku text primary key,
  reorder_threshold integer not null check (reorder_threshold >= 0),
  updated_by text not null,
  updated_at timestamptz not null default now()
);

create view sku_qty_summary as select sku, sum(qty_available) as total_qty from approved group by sku;

create index idx_orders_batch on orders(batch_number);
create index idx_orders_status on orders(status);
create index idx_orders_vendor on orders(vendor);
create index idx_received_batch on received(batch_number);
create index idx_testing_batch on testing(batch_number);
create index idx_approved_batch on approved(batch_number);
create index idx_on_website_batch on on_website(batch_number);
create index idx_audit_log_timestamp on audit_log(timestamp desc);
create index idx_audit_log_batch on audit_log(batch_number);
create index idx_audit_log_user on audit_log(user_name);

alter table orders enable row level security;
alter table received enable row level security;
alter table testing enable row level security;
alter table approved enable row level security;
alter table on_website enable row level security;
alter table audit_log enable row level security;
alter table sku_thresholds enable row level security;

create policy "allow all" on orders for all using (true) with check (true);
create policy "allow all" on received for all using (true) with check (true);
create policy "allow all" on testing for all using (true) with check (true);
create policy "allow all" on approved for all using (true) with check (true);
create policy "allow all" on on_website for all using (true) with check (true);
create policy "allow all" on audit_log for all using (true) with check (true);
create policy "allow all" on sku_thresholds for all using (true) with check (true);

alter publication supabase_realtime add table orders;
alter publication supabase_realtime add table received;
alter publication supabase_realtime add table testing;
alter publication supabase_realtime add table approved;
alter publication supabase_realtime add table on_website;
alter publication supabase_realtime add table audit_log;
