-- ─────────────────────────────────────────────────────────────────────────────
-- DrivnDashboardr — Full Supabase Schema
-- Run this in the Supabase SQL editor (Dashboard → SQL Editor → New query)
-- ─────────────────────────────────────────────────────────────────────────────

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ─── Users ────────────────────────────────────────────────────────────────────

create table if not exists users (
  id           uuid primary key references auth.users on delete cascade,
  name         text not null default '',
  business_name text not null default '',
  ig_handle    text not null default '',
  base_currency text not null default 'NOK',
  timezone     text not null default 'Europe/Oslo',
  onboarding_complete boolean not null default false,
  created_at   timestamp with time zone default now()
);

alter table users enable row level security;
create policy "Users can read their own profile"
  on users for select using (auth.uid() = id);
create policy "Users can update their own profile"
  on users for update using (auth.uid() = id);
create policy "Users can insert their own profile"
  on users for insert with check (auth.uid() = id);

-- ─── Secondary Currencies ─────────────────────────────────────────────────────

create table if not exists secondary_currencies (
  id                 uuid primary key default uuid_generate_v4(),
  user_id            uuid not null references users on delete cascade,
  currency_code      text not null,
  label              text not null default '',
  estimated_monthly  numeric not null default 0,
  created_at         timestamp with time zone default now()
);

alter table secondary_currencies enable row level security;
create policy "Users manage own secondary currencies"
  on secondary_currencies for all using (auth.uid() = user_id);

-- ─── Ad Spend Log ─────────────────────────────────────────────────────────────

create table if not exists ad_spend_log (
  id               uuid primary key default uuid_generate_v4(),
  user_id          uuid not null references users on delete cascade,
  currency_code    text not null,
  month            text not null,       -- e.g. '2026-03'
  estimated_amount numeric not null default 0,
  actual_amount    numeric not null default 0,
  confirmed        boolean not null default false,
  created_at       timestamp with time zone default now()
);

alter table ad_spend_log enable row level security;
create policy "Users manage own ad spend log"
  on ad_spend_log for all using (auth.uid() = user_id);

-- ─── KPI Targets ──────────────────────────────────────────────────────────────

create table if not exists kpi_targets (
  id                  uuid primary key default uuid_generate_v4(),
  user_id             uuid not null references users on delete cascade,
  cash_target         numeric,
  revenue_target      numeric,
  clients_target      numeric,
  meetings_target     numeric,
  followers_target    numeric,
  close_rate_target   numeric,
  show_up_target      numeric,
  updated_at          timestamp with time zone default now(),
  unique (user_id)
);

alter table kpi_targets enable row level security;
create policy "Users manage own KPI targets"
  on kpi_targets for all using (auth.uid() = user_id);

-- ─── Setters ──────────────────────────────────────────────────────────────────

create table if not exists setters (
  id         uuid primary key default uuid_generate_v4(),
  user_id    uuid not null references users on delete cascade,
  name       text not null,
  role       text not null check (role in ('setter', 'closer', 'both')),
  is_self    boolean not null default false,
  active     boolean not null default true,
  created_at timestamp with time zone default now()
);

alter table setters enable row level security;
create policy "Users manage own setters"
  on setters for all using (auth.uid() = user_id);

-- ─── Leads ────────────────────────────────────────────────────────────────────

create table if not exists leads (
  id               uuid primary key default uuid_generate_v4(),
  user_id          uuid not null references users on delete cascade,
  ig_username      text not null default '',
  full_name        text not null default '',
  phone            text not null default '',
  source           text not null default '',
  stage            text not null default 'follower'
                     check (stage in ('follower','replied','freebie_sent','call_booked','closed','nurture','bad_fit','not_interested')),
  tier             integer check (tier in (1,2,3)),
  setter_id        uuid references setters on delete set null,
  closer_id        uuid references setters on delete set null,
  setter_notes     text not null default '',
  call_booked_at   timestamp with time zone,
  call_outcome     text check (call_outcome in ('showed','no_show','canceled','rescheduled')),
  call_closed      boolean not null default false,
  call_objection   text check (call_objection in ('money','partner','timing','trust','other')),
  call_notes       text not null default '',
  freebie_sent_at  timestamp with time zone,
  last_contact_at  timestamp with time zone,
  source_flow      text not null default '',
  not_interested   boolean not null default false,
  created_at       timestamp with time zone default now(),
  updated_at       timestamp with time zone default now()
);

alter table leads enable row level security;
create policy "Users manage own leads"
  on leads for all using (auth.uid() = user_id);

-- Auto-update updated_at
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger leads_updated_at
  before update on leads
  for each row execute function update_updated_at();

-- ─── Lead Labels ──────────────────────────────────────────────────────────────

create table if not exists lead_labels (
  id         uuid primary key default uuid_generate_v4(),
  user_id    uuid not null references users on delete cascade,
  name       text not null,
  bg_color   text not null default '#E5E7EB',
  text_color text not null default '#374151',
  created_at timestamp with time zone default now()
);

alter table lead_labels enable row level security;
create policy "Users manage own lead labels"
  on lead_labels for all using (auth.uid() = user_id);

-- ─── Lead Label Assignments ───────────────────────────────────────────────────

create table if not exists lead_label_assignments (
  id       uuid primary key default uuid_generate_v4(),
  lead_id  uuid not null references leads on delete cascade,
  label_id uuid not null references lead_labels on delete cascade,
  unique (lead_id, label_id)
);

alter table lead_label_assignments enable row level security;
create policy "Users manage label assignments for own leads"
  on lead_label_assignments for all
  using (
    exists (
      select 1 from leads
      where leads.id = lead_label_assignments.lead_id
        and leads.user_id = auth.uid()
    )
  );

-- ─── Lead History ─────────────────────────────────────────────────────────────

create table if not exists lead_history (
  id         uuid primary key default uuid_generate_v4(),
  lead_id    uuid not null references leads on delete cascade,
  action     text not null,
  actor      text not null default 'System',
  created_at timestamp with time zone default now()
);

alter table lead_history enable row level security;
create policy "Users read history for own leads"
  on lead_history for select
  using (
    exists (
      select 1 from leads
      where leads.id = lead_history.lead_id
        and leads.user_id = auth.uid()
    )
  );
create policy "Users insert history for own leads"
  on lead_history for insert
  with check (
    exists (
      select 1 from leads
      where leads.id = lead_history.lead_id
        and leads.user_id = auth.uid()
    )
  );

-- ─── Clients ──────────────────────────────────────────────────────────────────

create table if not exists clients (
  id                    uuid primary key default uuid_generate_v4(),
  user_id               uuid not null references users on delete cascade,
  lead_id               uuid references leads on delete set null,
  ig_username           text not null default '',
  full_name             text not null default '',
  payment_type          text not null check (payment_type in ('pif','split','plan')),
  plan_months           integer,
  monthly_amount        numeric,
  total_amount          numeric not null default 0,
  currency              text not null default 'NOK',
  started_at            timestamp with time zone default now(),
  closer_id             uuid references setters on delete set null,
  upsell_reminder_month integer,
  upsell_reminder_set   boolean not null default false,
  notes                 text not null default '',
  active                boolean not null default true,
  created_at            timestamp with time zone default now()
);

alter table clients enable row level security;
create policy "Users manage own clients"
  on clients for all using (auth.uid() = user_id);

-- ─── Payment Installments ─────────────────────────────────────────────────────

create table if not exists payment_installments (
  id                   uuid primary key default uuid_generate_v4(),
  client_id            uuid not null references clients on delete cascade,
  month_number         integer not null,
  due_date             date not null,
  amount               numeric not null,
  paid                 boolean not null default false,
  paid_at              timestamp with time zone,
  stripe_payment_id    text,
  manually_confirmed   boolean not null default false,
  created_at           timestamp with time zone default now()
);

alter table payment_installments enable row level security;
create policy "Users manage installments for own clients"
  on payment_installments for all
  using (
    exists (
      select 1 from clients
      where clients.id = payment_installments.client_id
        and clients.user_id = auth.uid()
    )
  );

-- ─── Tasks ────────────────────────────────────────────────────────────────────

create table if not exists tasks (
  id             uuid primary key default uuid_generate_v4(),
  user_id        uuid not null references users on delete cascade,
  type           text not null check (type in ('follow_up','payment','invoice','upsell','nurture','call_outcome','ad_spend','manual')),
  priority       text not null check (priority in ('overdue','today','this_week','upcoming')),
  title          text not null,
  description    text not null default '',
  lead_id        uuid references leads on delete cascade,
  client_id      uuid references clients on delete cascade,
  due_at         timestamp with time zone not null,
  completed      boolean not null default false,
  completed_at   timestamp with time zone,
  auto_generated boolean not null default false,
  created_at     timestamp with time zone default now()
);

alter table tasks enable row level security;
create policy "Users manage own tasks"
  on tasks for all using (auth.uid() = user_id);

-- ─── Follow-up Schedule ───────────────────────────────────────────────────────

create table if not exists follow_up_schedule (
  id               uuid primary key default uuid_generate_v4(),
  lead_id          uuid not null references leads on delete cascade,
  phase            text not null check (phase in ('48hr','weekly','monthly','bimonthly')),
  next_follow_up_at timestamp with time zone not null,
  follow_up_count  integer not null default 0,
  paused           boolean not null default false,
  created_at       timestamp with time zone default now()
);

alter table follow_up_schedule enable row level security;
create policy "Users manage follow-up schedules for own leads"
  on follow_up_schedule for all
  using (
    exists (
      select 1 from leads
      where leads.id = follow_up_schedule.lead_id
        and leads.user_id = auth.uid()
    )
  );

-- ─── Team Members ─────────────────────────────────────────────────────────────

create table if not exists team_members (
  id             uuid primary key default uuid_generate_v4(),
  workspace_id   uuid not null references users on delete cascade,
  user_id        uuid references users on delete set null,
  email          text not null,
  name           text not null,
  role           text not null check (role in ('setter','closer','both','admin')),
  status         text not null default 'invited' check (status in ('invited','active','deactivated')),
  invite_token   text not null default uuid_generate_v4()::text,
  invite_sent_at timestamp with time zone default now(),
  accepted_at    timestamp with time zone,
  created_at     timestamp with time zone default now()
);

alter table team_members enable row level security;
create policy "Workspace owner manages team"
  on team_members for all using (auth.uid() = workspace_id);
create policy "Team members can read own record"
  on team_members for select using (auth.uid() = user_id);

-- ─── EOD Reports ──────────────────────────────────────────────────────────────

create table if not exists eod_reports (
  id                  uuid primary key default uuid_generate_v4(),
  workspace_id        uuid not null references users on delete cascade,
  setter_id           uuid not null references setters on delete cascade,
  date                date not null,
  leads_contacted     integer not null default 0,
  new_leads_added     integer not null default 0,
  freebies_sent       integer not null default 0,
  calls_booked        integer not null default 0,
  calls_held          integer not null default 0,
  calls_closed        integer not null default 0,
  total_cash_collected numeric not null default 0,
  biggest_win         text not null default '',
  biggest_challenge   text not null default '',
  notes               text not null default '',
  submitted_at        timestamp with time zone default now(),
  created_at          timestamp with time zone default now(),
  unique (setter_id, date)
);

alter table eod_reports enable row level security;
create policy "Workspace owner reads all EOD reports"
  on eod_reports for select using (auth.uid() = workspace_id);
create policy "Setters manage own EOD reports"
  on eod_reports for all
  using (
    exists (
      select 1 from setters
      where setters.id = eod_reports.setter_id
        and setters.user_id = auth.uid()
    )
  );

-- ─── Monthly Snapshots ────────────────────────────────────────────────────────

create table if not exists monthly_snapshots (
  id                   uuid primary key default uuid_generate_v4(),
  user_id              uuid not null references users on delete cascade,
  month                text not null,  -- e.g. '2026-03'
  cash_collected       numeric not null default 0,
  revenue_contracted   numeric not null default 0,
  new_followers        integer not null default 0,
  meetings_booked      integer not null default 0,
  calls_held           integer not null default 0,
  clients_signed       integer not null default 0,
  close_rate           numeric not null default 0,
  show_up_rate         numeric not null default 0,
  no_show_rate         numeric not null default 0,
  cancellation_rate    numeric not null default 0,
  created_at           timestamp with time zone default now(),
  unique (user_id, month)
);

alter table monthly_snapshots enable row level security;
create policy "Users manage own monthly snapshots"
  on monthly_snapshots for all using (auth.uid() = user_id);

-- ─── Exchange Rate Cache ──────────────────────────────────────────────────────

create table if not exists exchange_rate_cache (
  base       text primary key,
  rates      jsonb not null,
  fetched_at timestamp with time zone not null default now()
);

-- No RLS — this table is shared / read-only for all users
-- Service role key only for writes (done via server-side code)
alter table exchange_rate_cache enable row level security;
create policy "Anyone can read exchange rate cache"
  on exchange_rate_cache for select using (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- Helper function: auto-create user profile on signup
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.users (id)
  values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
