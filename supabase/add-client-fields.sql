-- Add missing client fields
-- Run in Supabase SQL Editor

alter table clients add column if not exists email text not null default '';
alter table clients add column if not exists phone text not null default '';
alter table clients add column if not exists program_type text not null default '';
alter table clients add column if not exists contract_end_date date;
alter table clients add column if not exists churn_reason text not null default '';
alter table clients add column if not exists referred_by text not null default '';
alter table clients add column if not exists total_paid numeric not null default 0;
