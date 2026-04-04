-- ─────────────────────────────────────────────────────────────────────────────
-- DRIVN — ALL MIGRATIONS
-- Paste this entire block into the Supabase SQL Editor and run once.
-- Safe to re-run: all statements use IF NOT EXISTS / DROP IF EXISTS.
-- ─────────────────────────────────────────────────────────────────────────────


-- ── 1. Google Sheets integration ─────────────────────────────────────────────

create table if not exists google_integrations (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  access_token    text not null,
  refresh_token   text not null,
  token_expiry    timestamptz not null,
  spreadsheet_id  text,
  spreadsheet_url text,
  last_synced_at  timestamptz,
  created_at      timestamptz default now(),
  unique (user_id)
);

alter table google_integrations enable row level security;

drop policy if exists "Users manage own google integration" on google_integrations;
create policy "Users manage own google integration"
  on google_integrations for all
  using (auth.uid() = user_id);


-- ── 2. Calendly integration ──────────────────────────────────────────────────

create table if not exists calendly_integrations (
  id                  uuid primary key default uuid_generate_v4(),
  user_id             uuid not null references auth.users on delete cascade unique,
  access_token        text not null,
  organization_uri    text not null default '',
  user_uri            text not null default '',
  webhook_signing_key text,
  connected_at        timestamp with time zone default now()
);

alter table calendly_integrations enable row level security;

drop policy if exists "Users manage own calendly integration" on calendly_integrations;
create policy "Users manage own calendly integration"
  on calendly_integrations for all using (auth.uid() = user_id);


-- ── 3. Extra client fields ───────────────────────────────────────────────────

alter table clients add column if not exists email text not null default '';
alter table clients add column if not exists phone text not null default '';
alter table clients add column if not exists program_type text not null default '';
alter table clients add column if not exists contract_end_date date;
alter table clients add column if not exists churn_reason text not null default '';
alter table clients add column if not exists referred_by text not null default '';
alter table clients add column if not exists total_paid numeric not null default 0;


-- ── 4. Stripe columns on users ───────────────────────────────────────────────

alter table users add column if not exists stripe_webhook_secret text;
alter table users add column if not exists stripe_connected boolean not null default false;


-- ── 5. Fix / refresh all RLS policies ────────────────────────────────────────

drop policy if exists "Users can read their own profile" on users;
drop policy if exists "Users can update their own profile" on users;
drop policy if exists "Users can insert their own profile" on users;
create policy "Users can read their own profile"   on users for select using (auth.uid() = id);
create policy "Users can update their own profile" on users for update using (auth.uid() = id);
create policy "Users can insert their own profile" on users for insert with check (auth.uid() = id);

drop policy if exists "Users manage own secondary currencies" on secondary_currencies;
create policy "Users manage own secondary currencies" on secondary_currencies for all using (auth.uid() = user_id);

drop policy if exists "Users manage own ad spend log" on ad_spend_log;
create policy "Users manage own ad spend log" on ad_spend_log for all using (auth.uid() = user_id);

drop policy if exists "Users manage own KPI targets" on kpi_targets;
create policy "Users manage own KPI targets" on kpi_targets for all using (auth.uid() = user_id);

drop policy if exists "Users manage own setters" on setters;
create policy "Users manage own setters" on setters for all using (auth.uid() = user_id);

drop policy if exists "Users manage own leads" on leads;
create policy "Users manage own leads" on leads for all using (auth.uid() = user_id);

drop policy if exists "Users manage own lead labels" on lead_labels;
create policy "Users manage own lead labels" on lead_labels for all using (auth.uid() = user_id);

drop policy if exists "Users manage label assignments for own leads" on lead_label_assignments;
create policy "Users manage label assignments for own leads"
  on lead_label_assignments for all
  using (exists (select 1 from leads where leads.id = lead_label_assignments.lead_id and leads.user_id = auth.uid()));

drop policy if exists "Users read history for own leads" on lead_history;
drop policy if exists "Users insert history for own leads" on lead_history;
create policy "Users read history for own leads"
  on lead_history for select
  using (exists (select 1 from leads where leads.id = lead_history.lead_id and leads.user_id = auth.uid()));
create policy "Users insert history for own leads"
  on lead_history for insert
  with check (exists (select 1 from leads where leads.id = lead_history.lead_id and leads.user_id = auth.uid()));

drop policy if exists "Users manage own clients" on clients;
create policy "Users manage own clients" on clients for all using (auth.uid() = user_id);

drop policy if exists "Users manage installments for own clients" on payment_installments;
create policy "Users manage installments for own clients"
  on payment_installments for all
  using (exists (select 1 from clients where clients.id = payment_installments.client_id and clients.user_id = auth.uid()));

drop policy if exists "Users manage own tasks" on tasks;
create policy "Users manage own tasks" on tasks for all using (auth.uid() = user_id);

drop policy if exists "Users manage follow-up schedules for own leads" on follow_up_schedule;
create policy "Users manage follow-up schedules for own leads"
  on follow_up_schedule for all
  using (exists (select 1 from leads where leads.id = follow_up_schedule.lead_id and leads.user_id = auth.uid()));

drop policy if exists "Workspace owner manages team" on team_members;
drop policy if exists "Team members can read own record" on team_members;
create policy "Workspace owner manages team"     on team_members for all using (auth.uid() = workspace_id);
create policy "Team members can read own record" on team_members for select using (auth.uid() = user_id);

drop policy if exists "Workspace owner reads all EOD reports" on eod_reports;
drop policy if exists "Setters manage own EOD reports" on eod_reports;
create policy "Workspace owner reads all EOD reports" on eod_reports for select using (auth.uid() = workspace_id);
create policy "Setters manage own EOD reports"
  on eod_reports for all
  using (exists (select 1 from setters where setters.id = eod_reports.setter_id and setters.user_id = auth.uid()));

drop policy if exists "Users manage own monthly snapshots" on monthly_snapshots;
create policy "Users manage own monthly snapshots" on monthly_snapshots for all using (auth.uid() = user_id);

drop policy if exists "Anyone can read exchange rate cache" on exchange_rate_cache;
create policy "Anyone can read exchange rate cache" on exchange_rate_cache for select using (true);


-- ── 6. Expenses table ────────────────────────────────────────────────────────

create table if not exists expenses (
  id         uuid primary key default uuid_generate_v4(),
  user_id    uuid not null references users on delete cascade,
  month      text not null,
  category   text not null check (category in ('team','software','ads','withdrawal','other')),
  label      text not null default '',
  amount     numeric not null default 0,
  currency   text not null default 'NOK',
  created_at timestamp with time zone default now()
);

alter table expenses enable row level security;

drop policy if exists "Users manage own expenses" on expenses;
create policy "Users manage own expenses"
  on expenses for all using (auth.uid() = user_id);


-- ── 7. Calendly OAuth fields ──────────────────────────────────────────────────
alter table calendly_integrations
  add column if not exists refresh_token text,
  add column if not exists token_expiry timestamp with time zone,
  add column if not exists user_name text,
  add column if not exists user_email text,
  add column if not exists webhook_signing_key text;


-- ── 8. Notification preferences ───────────────────────────────────────────────
-- Single JSONB column on users. Defaults defined here; app merges with these
-- so adding new keys in future is safe without another migration.
alter table users
  add column if not exists notification_prefs jsonb not null default '{}'::jsonb;


-- ── 9. Task reminders ─────────────────────────────────────────────────────────
-- Optional reminder timestamp on tasks. When set, the task surfaces in the
-- list early (at reminder_at) so the user gets a heads-up before the due date.
alter table tasks
  add column if not exists reminder_at timestamp with time zone;


-- ── 10. Lead tier ─────────────────────────────────────────────────────────────
-- 1 = hot, 2 = warm (default), 3 = cold.
-- Controls per-tier follow-up thresholds in the task generator.
alter table leads
  add column if not exists tier int check (tier in (1, 2, 3)) default 2;


-- ── 11. Tasks v2 — Non-Negotiables + Power Tasks ──────────────────────────────

create table if not exists non_negotiables (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references users on delete cascade,
  title      text not null,
  position   integer not null default 0,
  active     boolean not null default true,
  created_at timestamp with time zone default now()
);
alter table non_negotiables enable row level security;
drop policy if exists "Users manage own non_negotiables" on non_negotiables;
create policy "Users manage own non_negotiables"
  on non_negotiables for all using (auth.uid() = user_id);

create table if not exists non_negotiable_completions (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references users on delete cascade,
  non_negotiable_id   uuid not null references non_negotiables on delete cascade,
  date                date not null default current_date,
  completed           boolean not null default false,
  completed_at        timestamp with time zone,
  unique (user_id, non_negotiable_id, date)
);
alter table non_negotiable_completions enable row level security;
drop policy if exists "Users manage own completions" on non_negotiable_completions;
create policy "Users manage own completions"
  on non_negotiable_completions for all using (auth.uid() = user_id);

create table if not exists power_tasks (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references users on delete cascade,
  title        text not null,
  category     text not null check (category in ('product','content','operations','personal')),
  due_date     date,
  completed    boolean not null default false,
  completed_at timestamp with time zone,
  position     integer not null default 0,
  created_at   timestamp with time zone default now()
);
alter table power_tasks enable row level security;
drop policy if exists "Users manage own power_tasks" on power_tasks;
create policy "Users manage own power_tasks"
  on power_tasks for all using (auth.uid() = user_id);

-- New columns on existing tables
alter table users add column if not exists daily_followup_target integer not null default 10;
alter table users add column if not exists nonneg_reset_hour integer not null default 0;
alter table users add column if not exists timezone text not null default 'Europe/Oslo';

alter table power_tasks
  add column if not exists recurrence text check (recurrence in ('daily', 'weekly')),
  add column if not exists recurrence_days integer[];

alter table non_negotiables
  add column if not exists days_of_week integer[];

-- ── 12. Ad spend currency on users ────────────────────────────────────────────
alter table users add column if not exists ad_spend_currency text not null default 'USD';

-- ── 13. Products ──────────────────────────────────────────────────────────────
create table if not exists products (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references users on delete cascade,
  name             text not null,
  description      text not null default '',
  price            numeric not null default 0,
  duration_months  integer,
  active           boolean not null default true,
  created_at       timestamp with time zone default now()
);
alter table products enable row level security;
drop policy if exists "Users manage own products" on products;
create policy "Users manage own products"
  on products for all using (auth.uid() = user_id);

-- ── 14. Power task completion log ─────────────────────────────────────────────
create table if not exists power_task_completions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references users on delete cascade,
  power_task_id   uuid references power_tasks on delete set null,
  task_title      text not null,
  category        text not null,
  completed_date  date not null default current_date,
  created_at      timestamp with time zone default now()
);
alter table power_task_completions enable row level security;
drop policy if exists "Users manage own power task completions" on power_task_completions;
create policy "Users manage own power task completions"
  on power_task_completions for all using (auth.uid() = user_id);

-- ── 15. Weekly story schedule ──────────────────────────────────────────────────
create table if not exists weekly_story_schedule (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references users on delete cascade unique,
  monday     text not null default '',
  tuesday    text not null default '',
  wednesday  text not null default '',
  thursday   text not null default '',
  friday     text not null default '',
  saturday   text not null default '',
  sunday     text not null default '',
  updated_at timestamp with time zone default now()
);
alter table weekly_story_schedule enable row level security;
drop policy if exists "Users manage own story schedule" on weekly_story_schedule;
create policy "Users manage own story schedule"
  on weekly_story_schedule for all using (auth.uid() = user_id);
