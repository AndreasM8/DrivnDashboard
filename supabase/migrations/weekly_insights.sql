create table if not exists weekly_insights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users on delete cascade,
  week_start date not null,
  insight_text text not null,
  generated_at timestamptz default now(),
  unique(user_id, week_start)
);

alter table weekly_insights enable row level security;

create policy "users_own_insights" on weekly_insights
  for all using (auth.uid() = user_id);
