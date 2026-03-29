-- ─────────────────────────────────────────────────────────────────────────────
-- Fix duplicate policy errors — run this if you get "policy already exists"
-- This drops all policies and recreates them cleanly.
-- ─────────────────────────────────────────────────────────────────────────────

-- Users
drop policy if exists "Users can read their own profile" on users;
drop policy if exists "Users can update their own profile" on users;
drop policy if exists "Users can insert their own profile" on users;
create policy "Users can read their own profile"   on users for select using (auth.uid() = id);
create policy "Users can update their own profile" on users for update using (auth.uid() = id);
create policy "Users can insert their own profile" on users for insert with check (auth.uid() = id);

-- Secondary currencies
drop policy if exists "Users manage own secondary currencies" on secondary_currencies;
create policy "Users manage own secondary currencies" on secondary_currencies for all using (auth.uid() = user_id);

-- Ad spend log
drop policy if exists "Users manage own ad spend log" on ad_spend_log;
create policy "Users manage own ad spend log" on ad_spend_log for all using (auth.uid() = user_id);

-- KPI targets
drop policy if exists "Users manage own KPI targets" on kpi_targets;
create policy "Users manage own KPI targets" on kpi_targets for all using (auth.uid() = user_id);

-- Setters
drop policy if exists "Users manage own setters" on setters;
create policy "Users manage own setters" on setters for all using (auth.uid() = user_id);

-- Leads
drop policy if exists "Users manage own leads" on leads;
create policy "Users manage own leads" on leads for all using (auth.uid() = user_id);

-- Lead labels
drop policy if exists "Users manage own lead labels" on lead_labels;
create policy "Users manage own lead labels" on lead_labels for all using (auth.uid() = user_id);

-- Lead label assignments
drop policy if exists "Users manage label assignments for own leads" on lead_label_assignments;
create policy "Users manage label assignments for own leads"
  on lead_label_assignments for all
  using (exists (select 1 from leads where leads.id = lead_label_assignments.lead_id and leads.user_id = auth.uid()));

-- Lead history
drop policy if exists "Users read history for own leads" on lead_history;
drop policy if exists "Users insert history for own leads" on lead_history;
create policy "Users read history for own leads"
  on lead_history for select
  using (exists (select 1 from leads where leads.id = lead_history.lead_id and leads.user_id = auth.uid()));
create policy "Users insert history for own leads"
  on lead_history for insert
  with check (exists (select 1 from leads where leads.id = lead_history.lead_id and leads.user_id = auth.uid()));

-- Clients
drop policy if exists "Users manage own clients" on clients;
create policy "Users manage own clients" on clients for all using (auth.uid() = user_id);

-- Payment installments
drop policy if exists "Users manage installments for own clients" on payment_installments;
create policy "Users manage installments for own clients"
  on payment_installments for all
  using (exists (select 1 from clients where clients.id = payment_installments.client_id and clients.user_id = auth.uid()));

-- Tasks
drop policy if exists "Users manage own tasks" on tasks;
create policy "Users manage own tasks" on tasks for all using (auth.uid() = user_id);

-- Follow-up schedule
drop policy if exists "Users manage follow-up schedules for own leads" on follow_up_schedule;
create policy "Users manage follow-up schedules for own leads"
  on follow_up_schedule for all
  using (exists (select 1 from leads where leads.id = follow_up_schedule.lead_id and leads.user_id = auth.uid()));

-- Team members
drop policy if exists "Workspace owner manages team" on team_members;
drop policy if exists "Team members can read own record" on team_members;
create policy "Workspace owner manages team"    on team_members for all using (auth.uid() = workspace_id);
create policy "Team members can read own record" on team_members for select using (auth.uid() = user_id);

-- EOD reports
drop policy if exists "Workspace owner reads all EOD reports" on eod_reports;
drop policy if exists "Setters manage own EOD reports" on eod_reports;
create policy "Workspace owner reads all EOD reports" on eod_reports for select using (auth.uid() = workspace_id);
create policy "Setters manage own EOD reports"
  on eod_reports for all
  using (exists (select 1 from setters where setters.id = eod_reports.setter_id and setters.user_id = auth.uid()));

-- Monthly snapshots
drop policy if exists "Users manage own monthly snapshots" on monthly_snapshots;
create policy "Users manage own monthly snapshots" on monthly_snapshots for all using (auth.uid() = user_id);

-- Exchange rate cache
drop policy if exists "Anyone can read exchange rate cache" on exchange_rate_cache;
create policy "Anyone can read exchange rate cache" on exchange_rate_cache for select using (true);
