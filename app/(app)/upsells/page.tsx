import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getEffectiveUserId } from '@/lib/admin'
import { resolveNotifPrefs } from '@/types'
import UpsellsClient from './UpsellsClient'
import type { PaymentType } from '@/types'

interface ClientRow {
  id: string
  ig_username: string
  full_name: string
  payment_type: PaymentType
  plan_months: number | null
  started_at: string
  contract_end_date: string | null
  upsell_reminder_set: boolean
  testimonial_requested_at: string | null
  referral_requested_at: string | null
  testimonial_opt_out: boolean
  referral_opt_out: boolean
}

export interface UpsellRow {
  clientId: string
  igUsername: string
  fullName: string
  paymentType: string
  planMonths: number | null
  startedAt: string
  contractEndDate: string | null
  taskCreated: boolean
  upsellDate: string | null  // ISO date string
  hasOpenTask: boolean
}

export interface EngagementRow {
  clientId: string
  igUsername: string
  fullName: string
  startedAt: string
  lastRequestedAt: string | null   // testimonial_requested_at or referral_requested_at
  optOut: boolean                   // testimonial_opt_out or referral_opt_out
  intervalMonths: number
}

export default async function UpsellsPage() {
  const supabase = await createServerSupabaseClient()
  const uid      = await getEffectiveUserId()

  const [
    { data: profileData },
    { data: clients },
    { data: upsellTasks },
  ] = await Promise.all([
    supabase.from('users').select('notification_prefs').eq('id', uid).single(),
    supabase.from('clients').select('id, ig_username, full_name, payment_type, plan_months, started_at, contract_end_date, upsell_reminder_set, testimonial_requested_at, referral_requested_at, testimonial_opt_out, referral_opt_out').eq('user_id', uid).eq('active', true).order('started_at'),
    supabase.from('tasks').select('client_id').eq('user_id', uid).eq('type', 'upsell').eq('completed', false),
  ])

  const prefs = resolveNotifPrefs(profileData?.notification_prefs)

  const openTaskClientIds = new Set((upsellTasks ?? []).map(t => t.client_id).filter(Boolean))

  const rows: UpsellRow[] = (clients ?? []).map((c: ClientRow) => {
    let upsellDate: string | null = null

    if (prefs.upsell_enabled && c.started_at) {
      try {
        if (prefs.upsell_timing === 'before_end') {
          // X months before contract end
          const base = c.contract_end_date
            ? new Date(c.contract_end_date)
            : c.plan_months
              ? (() => { const d = new Date(c.started_at); d.setMonth(d.getMonth() + c.plan_months); return d })()
              : null
          if (base) {
            base.setMonth(base.getMonth() - prefs.upsell_months)
            upsellDate = base.toISOString().slice(0, 10)
          }
        } else {
          // X months after start
          const d = new Date(c.started_at)
          d.setMonth(d.getMonth() + prefs.upsell_months)
          upsellDate = d.toISOString().slice(0, 10)
        }
      } catch {
        upsellDate = null
      }
    }

    return {
      clientId:        c.id,
      igUsername:      c.ig_username,
      fullName:        c.full_name,
      paymentType:     c.payment_type,
      planMonths:      c.plan_months,
      startedAt:       c.started_at,
      contractEndDate: c.contract_end_date,
      taskCreated:     c.upsell_reminder_set,
      upsellDate,
      hasOpenTask:     openTaskClientIds.has(c.id),
    }
  })

  const testimonialRows: EngagementRow[] = (clients ?? []).map((c: ClientRow) => ({
    clientId:        c.id,
    igUsername:      c.ig_username,
    fullName:        c.full_name,
    startedAt:       c.started_at,
    lastRequestedAt: c.testimonial_requested_at ?? null,
    optOut:          c.testimonial_opt_out ?? false,
    intervalMonths:  prefs.testimonial_interval_months,
  }))

  const referralRows: EngagementRow[] = (clients ?? []).map((c: ClientRow) => ({
    clientId:        c.id,
    igUsername:      c.ig_username,
    fullName:        c.full_name,
    startedAt:       c.started_at,
    lastRequestedAt: c.referral_requested_at ?? null,
    optOut:          c.referral_opt_out ?? false,
    intervalMonths:  prefs.referral_interval_months,
  }))

  return (
    <UpsellsClient
      rows={rows}
      upsellEnabled={prefs.upsell_enabled}
      upsellTiming={prefs.upsell_timing}
      upsellMonths={prefs.upsell_months}
      testimonialRows={testimonialRows}
      referralRows={referralRows}
      testimonialEnabled={prefs.testimonial_enabled}
      testimonialInterval={prefs.testimonial_interval_months}
      referralEnabled={prefs.referral_enabled}
      referralInterval={prefs.referral_interval_months}
    />
  )
}
