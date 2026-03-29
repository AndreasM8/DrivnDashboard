-- Calendly integration table
-- Run in Supabase SQL Editor

create table if not exists calendly_integrations (
  id                  uuid primary key default uuid_generate_v4(),
  user_id             uuid not null references users on delete cascade unique,
  access_token        text not null,
  organization_uri    text not null default '',
  user_uri            text not null default '',
  webhook_signing_key text,
  connected_at        timestamp with time zone default now()
);

alter table calendly_integrations enable row level security;
create policy "Users manage own calendly integration"
  on calendly_integrations for all using (auth.uid() = user_id);
