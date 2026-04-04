-- Non-negotiable habit items (the recurring daily list)
create table if not exists non_negotiables (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references users on delete cascade,
  title      text not null,
  position   integer not null default 0,
  active     boolean not null default true,
  created_at timestamp with time zone default now()
);
alter table non_negotiables enable row level security;
create policy "Users manage own non_negotiables"
  on non_negotiables for all using (auth.uid() = user_id);

-- Daily completion state — one row per (user, item, date). Resets naturally by date.
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
create policy "Users manage own completions"
  on non_negotiable_completions for all using (auth.uid() = user_id);

-- Powerlist and personal tasks (persist until done/deleted)
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
create policy "Users manage own power_tasks"
  on power_tasks for all using (auth.uid() = user_id);

-- Daily follow-up target on users table
alter table users add column if not exists daily_followup_target integer not null default 10;
