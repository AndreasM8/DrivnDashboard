-- Extend expenses category CHECK constraint
alter table expenses drop constraint if exists expenses_category_check;
alter table expenses add constraint expenses_category_check check (
  category in ('team', 'software', 'ads', 'withdrawal', 'other', 'salary', 'subscriptions', 'investments')
);

-- Add team expense metadata columns
alter table expenses add column if not exists team_role text check (team_role in ('setter', 'closer', 'editor', 'growth_partner'));
alter table expenses add column if not exists payment_structure text check (payment_structure in ('monthly', 'retainer', 'both'));

-- Add testimonial/referral tracking to clients
alter table clients add column if not exists testimonial_requested_at timestamptz;
alter table clients add column if not exists referral_requested_at timestamptz;
alter table clients add column if not exists testimonial_opt_out boolean not null default false;
alter table clients add column if not exists referral_opt_out boolean not null default false;
