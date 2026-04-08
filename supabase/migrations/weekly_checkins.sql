create table if not exists weekly_checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users on delete cascade,
  week_start date not null,
  week_end date not null,
  submitted_at timestamptz,
  snoozed_until timestamptz,
  biggest_win text,
  main_focus text,
  support_needed text,
  program_suggestions text,
  week_summary text,
  happiness_rating integer check (happiness_rating between 1 and 10),
  followers_gained integer,
  replies_received integer,
  calls_booked integer,
  clients_closed integer,
  cash_collected numeric,
  revenue_contracted numeric,
  ad_spend numeric,
  ad_spend_confirmed boolean default false,
  system_followers_gained integer,
  system_replies_received integer,
  system_calls_booked integer,
  system_clients_closed integer,
  system_cash_collected numeric,
  system_revenue_contracted numeric,
  created_at timestamptz default now(),
  unique(user_id, week_start)
);

alter table users
  add column if not exists checkin_day integer not null default 0,
  add column if not exists checkin_enabled boolean not null default true;
