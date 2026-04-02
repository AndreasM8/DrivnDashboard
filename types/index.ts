// ─── Users ────────────────────────────────────────────────────────────────────

export type UpsellTiming = 'after_start' | 'before_end'

export interface NotificationPrefs {
  followup_enabled: boolean
  followup_days: number        // kept for compat; use tier-specific fields when set
  followup_days_tier1: number  // hot lead (tier 1) — days without contact
  followup_days_tier2: number  // warm lead (tier 2) — days without contact
  followup_days_tier3: number  // cold lead (tier 3) — days without contact
  overdue_days: number         // days without contact before marked overdue
  call_outcome_enabled: boolean
  call_outcome_hours: number   // hours after call to create log-outcome task
  payment_enabled: boolean
  payment_days_before: number  // days before due date to create payment task
  upsell_enabled: boolean
  upsell_timing: UpsellTiming  // 'after_start' or 'before_end'
  upsell_months: number        // months offset for upsell reminder
  daily_digest_enabled: boolean
}

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  followup_enabled: true,
  followup_days: 3,
  followup_days_tier1: 1,
  followup_days_tier2: 3,
  followup_days_tier3: 7,
  overdue_days: 7,
  call_outcome_enabled: true,
  call_outcome_hours: 2,
  payment_enabled: true,
  payment_days_before: 3,
  upsell_enabled: true,
  upsell_timing: 'before_end',
  upsell_months: 1,
  daily_digest_enabled: true,
}

export function resolveNotifPrefs(raw: Partial<NotificationPrefs> | null | undefined): NotificationPrefs {
  return { ...DEFAULT_NOTIFICATION_PREFS, ...(raw ?? {}) }
}

export interface User {
  id: string
  name: string
  business_name: string
  ig_handle: string
  base_currency: string
  timezone: string
  notification_prefs: Partial<NotificationPrefs>
  created_at: string
}

// ─── Currencies ───────────────────────────────────────────────────────────────

export interface SecondaryCurrency {
  id: string
  user_id: string
  currency_code: string
  label: string
  estimated_monthly: number
  created_at: string
}

export interface AdSpendLog {
  id: string
  user_id: string
  currency_code: string
  month: string
  estimated_amount: number
  actual_amount: number
  confirmed: boolean
  created_at: string
}

// ─── KPI Targets ──────────────────────────────────────────────────────────────

export interface KpiTargets {
  id: string
  user_id: string
  cash_target: number
  revenue_target: number
  clients_target: number
  meetings_target: number
  followers_target: number
  reply_rate_target: number    // % of followers who reply
  booking_rate_target: number  // % of replies who book a call
  close_rate_target: number    // % of calls that close
  show_up_target: number       // % of booked calls that show up
  updated_at: string
}

// ─── Setters / Closers ────────────────────────────────────────────────────────

export type SetterRole = 'setter' | 'closer' | 'both'

export interface Setter {
  id: string
  user_id: string
  name: string
  role: SetterRole
  is_self: boolean
  active: boolean
  created_at: string
}

// ─── Leads ────────────────────────────────────────────────────────────────────

export type LeadStage =
  | 'follower'
  | 'replied'
  | 'freebie_sent'
  | 'call_booked'
  | 'closed'
  | 'nurture'
  | 'bad_fit'
  | 'not_interested'

export type LeadTier = 1 | 2 | 3

export type CallOutcome = 'showed' | 'no_show' | 'canceled' | 'rescheduled'

export type CallObjection = 'money' | 'partner' | 'timing' | 'trust' | 'other'

export interface Lead {
  id: string
  user_id: string
  ig_username: string
  full_name: string
  phone: string
  source: string
  stage: LeadStage
  tier: LeadTier
  setter_id: string | null
  closer_id: string | null
  setter_notes: string
  call_booked_at: string | null
  call_outcome: CallOutcome | null
  call_closed: boolean
  call_objection: CallObjection | null
  call_notes: string
  freebie_sent_at: string | null
  last_contact_at: string | null
  source_flow: string
  not_interested: boolean
  created_at: string
  updated_at: string
}

export interface LeadLabel {
  id: string
  user_id: string
  name: string
  bg_color: string
  text_color: string
  created_at: string
}

export interface LeadLabelAssignment {
  id: string
  lead_id: string
  label_id: string
}

export interface LeadHistory {
  id: string
  lead_id: string
  action: string
  actor: string
  created_at: string
}

// ─── Clients ──────────────────────────────────────────────────────────────────

export type PaymentType = 'pif' | 'split' | 'plan'

export interface Client {
  id: string
  user_id: string
  lead_id: string | null
  ig_username: string
  full_name: string
  email: string
  phone: string
  program_type: string
  referred_by: string
  payment_type: PaymentType
  plan_months: number | null
  monthly_amount: number | null
  total_amount: number
  total_paid: number
  currency: string
  started_at: string
  contract_end_date: string | null
  closer_id: string | null
  upsell_reminder_month: number | null
  upsell_reminder_set: boolean
  notes: string
  churn_reason: string
  active: boolean
  created_at: string
}

export interface PaymentInstallment {
  id: string
  client_id: string
  month_number: number
  due_date: string
  amount: number
  paid: boolean
  paid_at: string | null
  stripe_payment_id: string | null
  manually_confirmed: boolean
  created_at: string
}

// ─── Tasks ────────────────────────────────────────────────────────────────────

export type TaskType =
  | 'follow_up'
  | 'payment'
  | 'invoice'
  | 'upsell'
  | 'nurture'
  | 'call_outcome'
  | 'ad_spend'
  | 'contract_end'
  | 'manual'

export type TaskPriority = 'overdue' | 'today' | 'this_week' | 'upcoming'

export interface Task {
  id: string
  user_id: string
  type: TaskType
  priority: TaskPriority
  title: string
  description: string
  lead_id: string | null
  client_id: string | null
  due_at: string
  reminder_at: string | null
  completed: boolean
  completed_at: string | null
  auto_generated: boolean
  created_at: string
}

// ─── Follow-up Schedule ───────────────────────────────────────────────────────

export type FollowUpPhase = '48hr' | 'weekly' | 'monthly' | 'bimonthly'

export interface FollowUpSchedule {
  id: string
  lead_id: string
  phase: FollowUpPhase
  next_follow_up_at: string
  follow_up_count: number
  paused: boolean
  created_at: string
}

// ─── Team ─────────────────────────────────────────────────────────────────────

export type TeamRole = 'setter' | 'closer' | 'both' | 'admin'
export type TeamStatus = 'invited' | 'active' | 'deactivated'

export interface TeamMember {
  id: string
  workspace_id: string
  user_id: string | null
  email: string
  name: string
  role: TeamRole
  status: TeamStatus
  invite_token: string
  invite_sent_at: string
  accepted_at: string | null
  created_at: string
}


// ─── Monthly Snapshots ────────────────────────────────────────────────────────

export interface MonthlySnapshot {
  id: string
  user_id: string
  month: string
  cash_collected: number
  revenue_contracted: number
  new_followers: number
  meetings_booked: number
  calls_held: number
  clients_signed: number
  close_rate: number
  show_up_rate: number
  no_show_rate: number
  cancellation_rate: number
  created_at: string
}

// ─── UI Helpers ───────────────────────────────────────────────────────────────

export interface TaskTypeStyle {
  bg: string
  text: string
  label: string
}

export const TASK_TYPE_STYLES: Record<TaskType, TaskTypeStyle> = {
  follow_up:    { bg: '#E6F1FB', text: '#0C447C', label: 'Follow-up' },
  payment:      { bg: '#FCEBEB', text: '#791F1F', label: 'Payment overdue' },
  invoice:      { bg: '#FAEEDA', text: '#633806', label: 'Invoice due' },
  upsell:       { bg: '#EEEDFE', text: '#3C3489', label: 'Upsell' },
  nurture:      { bg: '#EAF3DE', text: '#27500A', label: 'Nurture' },
  call_outcome: { bg: '#E1F5EE', text: '#085041', label: 'Log outcome' },
  ad_spend:     { bg: '#FFF3CD', text: '#856404', label: 'Ad spend' },
  contract_end: { bg: '#FEE2E2', text: '#991B1B', label: 'Contract ending' },
  manual:       { bg: '#F3F4F6', text: '#374151', label: 'Task' },
}

export const STAGE_LABELS: Record<LeadStage, string> = {
  follower:       'Follower',
  replied:        'Replied',
  freebie_sent:   'Freebie sent',
  call_booked:    'Call booked',
  closed:         'Closed',
  nurture:        'Nurture',
  bad_fit:        'Bad fit',
  not_interested: 'Not interested',
}

export const CURRENCIES = [
  { code: 'NOK', label: 'Norwegian Krone', flag: '🇳🇴' },
  { code: 'USD', label: 'US Dollar',        flag: '🇺🇸' },
  { code: 'EUR', label: 'Euro',             flag: '🇪🇺' },
  { code: 'GBP', label: 'British Pound',    flag: '🇬🇧' },
  { code: 'AED', label: 'UAE Dirham',       flag: '🇦🇪' },
  { code: 'SEK', label: 'Swedish Krona',    flag: '🇸🇪' },
  { code: 'DKK', label: 'Danish Krone',     flag: '🇩🇰' },
  { code: 'AUD', label: 'Australian Dollar',flag: '🇦🇺' },
]

// ─── Expenses ─────────────────────────────────────────────────────────────────

export interface Expense {
  id: string
  user_id: string
  month: string
  category: 'team' | 'software' | 'ads' | 'withdrawal' | 'other'
  label: string
  amount: number
  currency: string
  created_at: string
}

// ─── Calendly ─────────────────────────────────────────────────────────────────

export interface CalendlyIntegration {
  id: string
  user_id: string
  access_token: string
  organization_uri: string
  user_uri: string
  webhook_signing_key: string | null
  connected_at: string
}

export const TIMEZONES = [
  'Europe/Oslo',
  'Europe/Stockholm',
  'Europe/Copenhagen',
  'Europe/London',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Phoenix',
  'America/Los_Angeles',
  'Asia/Dubai',
  'Asia/Bangkok',
  'Asia/Jakarta',
  'Asia/Singapore',
  'Australia/Sydney',
]
