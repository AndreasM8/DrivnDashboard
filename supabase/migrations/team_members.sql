-- Team members
create table if not exists team_members (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.users(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  role text not null check (role in ('setter', 'closer')),
  name text not null,
  email text not null,
  status text not null default 'invited' check (status in ('invited', 'active', 'inactive')),
  permissions jsonb not null default '{
    "pipeline": true,
    "clients": false,
    "finances": false,
    "labels": true,
    "content": false
  }',
  invite_token text unique default gen_random_uuid()::text,
  invite_expires_at timestamptz default now() + interval '7 days',
  created_at timestamptz not null default now()
);

-- EOD + weekly check-in templates (per team member)
create table if not exists team_checkin_templates (
  id uuid primary key default gen_random_uuid(),
  team_member_id uuid not null references team_members(id) on delete cascade,
  coach_id uuid not null references public.users(id) on delete cascade,
  type text not null check (type in ('eod', 'weekly')),
  questions jsonb not null default '[]',
  weekly_enabled boolean not null default false,
  weekly_day int default 0 check (weekly_day between 0 and 6),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(team_member_id, type)
);

-- EOD report submissions
create table if not exists team_eod_reports (
  id uuid primary key default gen_random_uuid(),
  team_member_id uuid not null references team_members(id) on delete cascade,
  coach_id uuid not null references public.users(id) on delete cascade,
  date date not null default current_date,
  answers jsonb not null default '[]',
  submitted_at timestamptz not null default now(),
  unique(team_member_id, date)
);

-- Weekly check-in submissions
create table if not exists team_weekly_checkins (
  id uuid primary key default gen_random_uuid(),
  team_member_id uuid not null references team_members(id) on delete cascade,
  coach_id uuid not null references public.users(id) on delete cascade,
  week_start date not null,
  week_end date not null,
  answers jsonb not null default '[]',
  submitted_at timestamptz not null default now(),
  unique(team_member_id, week_start)
);

-- Shared team tasks (coach and team member both see)
create table if not exists team_tasks (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.users(id) on delete cascade,
  assigned_to uuid references team_members(id) on delete set null,
  title text not null,
  description text,
  priority text not null default 'this_week' check (priority in ('today', 'this_week', 'later')),
  done boolean not null default false,
  done_at timestamptz,
  due_at timestamptz,
  created_at timestamptz not null default now()
);

-- Personal tasks (only team member can see)
create table if not exists team_personal_tasks (
  id uuid primary key default gen_random_uuid(),
  team_member_id uuid not null references team_members(id) on delete cascade,
  title text not null,
  priority text not null default 'this_week' check (priority in ('today', 'this_week', 'later')),
  done boolean not null default false,
  done_at timestamptz,
  due_at timestamptz,
  created_at timestamptz not null default now()
);

-- Non-negotiables set by coach for team member
create table if not exists team_non_negotiables (
  id uuid primary key default gen_random_uuid(),
  team_member_id uuid not null references team_members(id) on delete cascade,
  coach_id uuid not null references public.users(id) on delete cascade,
  title text not null,
  order_index int not null default 0,
  created_at timestamptz not null default now()
);

-- Daily completions of non-negotiables
create table if not exists team_nonneg_completions (
  id uuid primary key default gen_random_uuid(),
  team_member_id uuid not null references team_members(id) on delete cascade,
  non_neg_id uuid not null references team_non_negotiables(id) on delete cascade,
  date date not null default current_date,
  completed_at timestamptz not null default now(),
  unique(team_member_id, non_neg_id, date)
);

-- Add language column to users
alter table public.users add column if not exists language text not null default 'en' check (language in ('en', 'no'));

-- RLS policies
alter table team_members enable row level security;
alter table team_checkin_templates enable row level security;
alter table team_eod_reports enable row level security;
alter table team_weekly_checkins enable row level security;
alter table team_tasks enable row level security;
alter table team_personal_tasks enable row level security;
alter table team_non_negotiables enable row level security;
alter table team_nonneg_completions enable row level security;

-- team_members: coach can do everything; team member can read their own row
create policy "coach_all_team_members" on team_members for all using (coach_id = auth.uid());
create policy "member_read_own" on team_members for select using (user_id = auth.uid());

-- team_checkin_templates: coach full access; team member read own
create policy "coach_all_templates" on team_checkin_templates for all using (coach_id = auth.uid());
create policy "member_read_own_templates" on team_checkin_templates for select using (
  team_member_id in (select id from team_members where user_id = auth.uid())
);

-- team_eod_reports: coach can read all for their team; member inserts/reads own
create policy "coach_read_eod" on team_eod_reports for select using (coach_id = auth.uid());
create policy "member_insert_eod" on team_eod_reports for insert with check (
  team_member_id in (select id from team_members where user_id = auth.uid())
);
create policy "member_read_own_eod" on team_eod_reports for select using (
  team_member_id in (select id from team_members where user_id = auth.uid())
);

-- team_weekly_checkins: same pattern
create policy "coach_read_weekly" on team_weekly_checkins for select using (coach_id = auth.uid());
create policy "member_insert_weekly" on team_weekly_checkins for insert with check (
  team_member_id in (select id from team_members where user_id = auth.uid())
);
create policy "member_read_own_weekly" on team_weekly_checkins for select using (
  team_member_id in (select id from team_members where user_id = auth.uid())
);

-- team_tasks: coach full access; team member reads all, marks done
create policy "coach_all_team_tasks" on team_tasks for all using (coach_id = auth.uid());
create policy "member_read_team_tasks" on team_tasks for select using (
  coach_id in (select coach_id from team_members where user_id = auth.uid())
);
create policy "member_update_team_tasks" on team_tasks for update using (
  coach_id in (select coach_id from team_members where user_id = auth.uid())
);

-- team_personal_tasks: only the member
create policy "member_all_personal_tasks" on team_personal_tasks for all using (
  team_member_id in (select id from team_members where user_id = auth.uid())
);

-- team_non_negotiables: coach full; member reads own
create policy "coach_all_team_nonneg" on team_non_negotiables for all using (coach_id = auth.uid());
create policy "member_read_own_nonneg" on team_non_negotiables for select using (
  team_member_id in (select id from team_members where user_id = auth.uid())
);

-- team_nonneg_completions: coach reads; member inserts and reads own
create policy "coach_read_completions" on team_nonneg_completions for select using (
  team_member_id in (select id from team_members where coach_id = auth.uid())
);
create policy "member_all_completions" on team_nonneg_completions for all using (
  team_member_id in (select id from team_members where user_id = auth.uid())
);

-- Add configurable EOD hour (coach sets per member, default 20 = 8pm)
alter table team_checkin_templates add column if not exists eod_hour int not null default 20 check (eod_hour between 0 and 23);
