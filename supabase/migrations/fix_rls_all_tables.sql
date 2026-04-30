-- ─────────────────────────────────────────────────────────────────
-- Enable RLS on all core tables — corrected table names
-- Apply in Supabase SQL editor
-- ─────────────────────────────────────────────────────────────────

-- ── users ─────────────────────────────────────────────────────────
alter table if exists users enable row level security;
drop policy if exists "users_self" on users;
create policy "users_self" on users using (auth.uid() = id);
drop policy if exists "users_self_update" on users;
create policy "users_self_update" on users for update using (auth.uid() = id);

-- ── leads ─────────────────────────────────────────────────────────
alter table if exists leads enable row level security;
drop policy if exists "leads_owner" on leads;
create policy "leads_owner" on leads using (auth.uid() = user_id);

-- ── lead_labels ───────────────────────────────────────────────────
alter table if exists lead_labels enable row level security;
drop policy if exists "lead_labels_owner" on lead_labels;
create policy "lead_labels_owner" on lead_labels using (auth.uid() = user_id);

-- ── lead_label_assignments ────────────────────────────────────────
alter table if exists lead_label_assignments enable row level security;
drop policy if exists "lead_label_assignments_owner" on lead_label_assignments;
create policy "lead_label_assignments_owner" on lead_label_assignments
  using (exists (
    select 1 from leads
    where leads.id = lead_label_assignments.lead_id and leads.user_id = auth.uid()
  ));

-- ── lead_history ──────────────────────────────────────────────────
alter table if exists lead_history enable row level security;
drop policy if exists "lead_history_owner" on lead_history;
create policy "lead_history_owner" on lead_history
  using (exists (
    select 1 from leads
    where leads.id = lead_history.lead_id and leads.user_id = auth.uid()
  ));

-- ── clients ───────────────────────────────────────────────────────
alter table if exists clients enable row level security;
drop policy if exists "clients_owner" on clients;
create policy "clients_owner" on clients using (auth.uid() = user_id);

-- ── payment_installments ──────────────────────────────────────────
alter table if exists payment_installments enable row level security;
drop policy if exists "payment_installments_owner" on payment_installments;
create policy "payment_installments_owner" on payment_installments
  using (exists (
    select 1 from clients
    where clients.id = payment_installments.client_id and clients.user_id = auth.uid()
  ));

-- ── tasks ─────────────────────────────────────────────────────────
alter table if exists tasks enable row level security;
drop policy if exists "tasks_owner" on tasks;
create policy "tasks_owner" on tasks using (auth.uid() = user_id);

-- ── non_negotiables ───────────────────────────────────────────────
alter table if exists non_negotiables enable row level security;
drop policy if exists "non_negotiables_owner" on non_negotiables;
create policy "non_negotiables_owner" on non_negotiables using (auth.uid() = user_id);

-- ── non_negotiable_completions ────────────────────────────────────
alter table if exists non_negotiable_completions enable row level security;
drop policy if exists "non_neg_completions_owner" on non_negotiable_completions;
create policy "non_neg_completions_owner" on non_negotiable_completions
  using (exists (
    select 1 from non_negotiables
    where non_negotiables.id = non_negotiable_completions.non_negotiable_id
      and non_negotiables.user_id = auth.uid()
  ));

-- ── power_tasks ───────────────────────────────────────────────────
alter table if exists power_tasks enable row level security;
drop policy if exists "power_tasks_owner" on power_tasks;
create policy "power_tasks_owner" on power_tasks using (auth.uid() = user_id);

-- ── power_task_completions ────────────────────────────────────────
alter table if exists power_task_completions enable row level security;
drop policy if exists "power_task_completions_owner" on power_task_completions;
create policy "power_task_completions_owner" on power_task_completions
  using (exists (
    select 1 from power_tasks
    where power_tasks.id = power_task_completions.power_task_id
      and power_tasks.user_id = auth.uid()
  ));

-- ── weekly_checkins ───────────────────────────────────────────────
alter table if exists weekly_checkins enable row level security;
drop policy if exists "weekly_checkins_owner" on weekly_checkins;
create policy "weekly_checkins_owner" on weekly_checkins using (auth.uid() = user_id);

-- ── monthly_snapshots ─────────────────────────────────────────────
alter table if exists monthly_snapshots enable row level security;
drop policy if exists "monthly_snapshots_owner" on monthly_snapshots;
create policy "monthly_snapshots_owner" on monthly_snapshots using (auth.uid() = user_id);

-- ── expenses ──────────────────────────────────────────────────────
alter table if exists expenses enable row level security;
drop policy if exists "expenses_owner" on expenses;
create policy "expenses_owner" on expenses using (auth.uid() = user_id);

-- ── ad_spend_log ──────────────────────────────────────────────────
alter table if exists ad_spend_log enable row level security;
drop policy if exists "ad_spend_log_owner" on ad_spend_log;
create policy "ad_spend_log_owner" on ad_spend_log using (auth.uid() = user_id);

-- ── products ──────────────────────────────────────────────────────
alter table if exists products enable row level security;
drop policy if exists "products_owner" on products;
create policy "products_owner" on products using (auth.uid() = user_id);

-- ── setters ───────────────────────────────────────────────────────
alter table if exists setters enable row level security;
drop policy if exists "setters_owner" on setters;
create policy "setters_owner" on setters using (auth.uid() = user_id);

-- ── kpi_targets ───────────────────────────────────────────────────
alter table if exists kpi_targets enable row level security;
drop policy if exists "kpi_targets_owner" on kpi_targets;
create policy "kpi_targets_owner" on kpi_targets using (auth.uid() = user_id);

-- ── secondary_currencies ──────────────────────────────────────────
alter table if exists secondary_currencies enable row level security;
drop policy if exists "secondary_currencies_owner" on secondary_currencies;
create policy "secondary_currencies_owner" on secondary_currencies using (auth.uid() = user_id);

-- ── story_items ───────────────────────────────────────────────────
alter table if exists story_items enable row level security;
drop policy if exists "story_items_owner" on story_items;
create policy "story_items_owner" on story_items using (auth.uid() = user_id);

-- ── story_item_posts ──────────────────────────────────────────────
alter table if exists story_item_posts enable row level security;
drop policy if exists "story_item_posts_owner" on story_item_posts;
create policy "story_item_posts_owner" on story_item_posts
  using (exists (
    select 1 from story_items
    where story_items.id = story_item_posts.story_item_id
      and story_items.user_id = auth.uid()
  ));

-- ── weekly_story_schedule ─────────────────────────────────────────
alter table if exists weekly_story_schedule enable row level security;
drop policy if exists "weekly_story_schedule_owner" on weekly_story_schedule;
create policy "weekly_story_schedule_owner" on weekly_story_schedule using (auth.uid() = user_id);

-- ── assistant_conversations ───────────────────────────────────────
alter table if exists assistant_conversations enable row level security;
drop policy if exists "assistant_conversations_owner" on assistant_conversations;
create policy "assistant_conversations_owner" on assistant_conversations using (auth.uid() = user_id);

-- ── assistant_memory ──────────────────────────────────────────────
alter table if exists assistant_memory enable row level security;
drop policy if exists "assistant_memory_owner" on assistant_memory;
create policy "assistant_memory_owner" on assistant_memory using (auth.uid() = user_id);

-- ── calendly_integrations ─────────────────────────────────────────
alter table if exists calendly_integrations enable row level security;
drop policy if exists "calendly_integrations_owner" on calendly_integrations;
create policy "calendly_integrations_owner" on calendly_integrations using (auth.uid() = user_id);

-- ── google_integrations ───────────────────────────────────────────
alter table if exists google_integrations enable row level security;
drop policy if exists "google_integrations_owner" on google_integrations;
create policy "google_integrations_owner" on google_integrations using (auth.uid() = user_id);

-- ── knowledge_chunks (shared, read-only for authenticated) ────────
alter table if exists knowledge_chunks enable row level security;
drop policy if exists "knowledge_chunks_read" on knowledge_chunks;
create policy "knowledge_chunks_read" on knowledge_chunks for select
  using (auth.role() = 'authenticated');

-- ── team tables (policies already created by team_members migration) ─
alter table if exists team_members enable row level security;
alter table if exists team_eod_reports enable row level security;
alter table if exists team_weekly_checkins enable row level security;
alter table if exists team_checkin_templates enable row level security;
alter table if exists team_tasks enable row level security;
alter table if exists team_non_negotiables enable row level security;
alter table if exists team_non_neg_completions enable row level security;

-- ── assistant_outputs ─────────────────────────────────────────────
alter table if exists assistant_outputs enable row level security;
drop policy if exists "assistant_outputs_owner" on assistant_outputs;
create policy "assistant_outputs_owner" on assistant_outputs using (auth.uid() = user_id);

