-- Add stripe_webhook_secret column to users table
-- Run in Supabase SQL Editor

alter table users add column if not exists stripe_webhook_secret text;
alter table users add column if not exists stripe_connected boolean not null default false;
