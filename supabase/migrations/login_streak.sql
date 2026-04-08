alter table users
  add column if not exists last_active_date date,
  add column if not exists login_streak integer not null default 0;
