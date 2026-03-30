create table if not exists expenses (
  id         uuid primary key default uuid_generate_v4(),
  user_id    uuid not null references users on delete cascade,
  month      text not null,  -- e.g. '2026-03'
  category   text not null check (category in ('team','software','ads','withdrawal','other')),
  label      text not null default '',
  amount     numeric not null default 0,
  currency   text not null default 'NOK',
  created_at timestamp with time zone default now()
);

alter table expenses enable row level security;
create policy "Users manage own expenses"
  on expenses for all using (auth.uid() = user_id);
