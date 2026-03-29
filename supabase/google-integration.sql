-- ─────────────────────────────────────────────────────────────────────────────
-- Google Sheets integration — OAuth token storage
-- Run this in the Supabase SQL editor
-- ─────────────────────────────────────────────────────────────────────────────

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
