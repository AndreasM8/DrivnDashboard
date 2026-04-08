import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getEffectiveUserId } from '@/lib/admin'
import { resolveNotifPrefs } from '@/types'
import UpsellsClient from './UpsellsClient'
import type { Client } from '@/types'

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

export default async function UpsellsPage() {
  const supabase = await createServerSupabaseClient()
  const uid      = await getEffectiveUserId()

  const [
    { data: profileData },
    { data: clients },
    { data: upsellTasks },
  ] = await Promise.all([
    supabase.from('users').select('notification_prefs').eq('id', uid).single(),
    supabase.from('clients').select('*').eq('user_id', uid).eq('active', true).order('started_at'),
    supabase.from('tasks').select('client_id').eq('user_id', uid).eq('type', 'upsell').eq('done', false),
  ])

  const prefs = resolveNotifPrefs(profileData?.notification_prefs)

  const openTaskClientIds = new Set((upsellTasks ?? []).map(t => t.client_id).filter(Boolean))

  const rows: UpsellRow[] = (clients ?? []).map((c: Client) => {
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

  return (
    <UpsellsClient
      rows={rows}
      upsellEnabled={prefs.upsell_enabled}
      upsellTiming={prefs.upsell_timing}
      upsellMonths={prefs.upsell_months}
    />
  )
}
