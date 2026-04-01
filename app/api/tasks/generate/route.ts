import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { resolveNotifPrefs } from '@/types'
import type { TaskPriority } from '@/types'

export async function POST() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('notification_prefs')
    .eq('id', user.id)
    .single()

  const prefs = resolveNotifPrefs(profile?.notification_prefs)
  const now   = new Date()
  let created = 0

  // ── Helper: check for existing open task ────────────────────────────────────
  async function hasOpenTask(type: string, leadId?: string, clientId?: string) {
    let q = supabase.from('tasks').select('id').eq('user_id', user!.id).eq('type', type).eq('completed', false)
    if (leadId)   q = q.eq('lead_id',   leadId)
    if (clientId) q = q.eq('client_id', clientId)
    const { data } = await q.limit(1)
    return (data?.length ?? 0) > 0
  }

  // ── 1. Follow-up tasks ───────────────────────────────────────────────────────
  if (prefs.followup_enabled) {
    const overdueCutoff = new Date(now.getTime() - prefs.overdue_days * 86400000).toISOString()

    const tierCutoff = (days: number) => new Date(now.getTime() - days * 86400000).toISOString()
    const cutoffs: Record<1 | 2 | 3, string> = {
      1: tierCutoff(prefs.followup_days_tier1),
      2: tierCutoff(prefs.followup_days_tier2),
      3: tierCutoff(prefs.followup_days_tier3),
    }

    const { data: leads, error: leadsError } = await supabase
      .from('leads')
      .select('id, ig_username, last_contact_at, stage, tier')
      .eq('user_id', user.id)
      .in('stage', ['follower', 'replied', 'freebie_sent'])

    if (leadsError) return NextResponse.json({ error: leadsError.message }, { status: 500 })

    const staleLeads = (leads ?? []).filter(l => {
      const tier   = (l.tier as 1 | 2 | 3) ?? 2
      const cutoff = cutoffs[tier] ?? cutoffs[2]
      return !l.last_contact_at || new Date(l.last_contact_at) < new Date(cutoff)
    })

    function followupPriority(lastContactAt: string | null): TaskPriority {
      if (!lastContactAt) return 'today'
      return new Date(lastContactAt) < new Date(overdueCutoff) ? 'overdue' : 'today'
    }

    for (const l of staleLeads) {
      if (await hasOpenTask('follow_up', l.id)) continue
      const tier = (l.tier as 1 | 2 | 3) ?? 2
      const days = tier === 1 ? prefs.followup_days_tier1 : tier === 3 ? prefs.followup_days_tier3 : prefs.followup_days_tier2
      const { error } = await supabase.from('tasks').insert({
        user_id:       user.id,
        type:          'follow_up',
        priority:      followupPriority(l.last_contact_at),
        title:         `Follow up — @${l.ig_username}`,
        description:   `No contact for ${days}+ days (${l.stage}, tier ${tier}).`,
        lead_id:       l.id,
        client_id:     null,
        due_at:        now.toISOString(),
        completed:     false,
        completed_at:  null,
        auto_generated: true,
      })
      if (!error) created++
    }
  }

  // ── 2. Payment tasks ─────────────────────────────────────────────────────────
  if (prefs.payment_enabled) {
    const paymentLookAhead = new Date(now.getTime() + prefs.payment_days_before * 86400000)

    // Fetch unpaid installments due within the look-ahead window
    const { data: installments } = await supabase
      .from('payment_installments')
      .select('id, client_id, due_date, amount, clients!inner(user_id, ig_username, full_name)')
      .eq('paid', false)
      .eq('clients.user_id', user.id)
      .lte('due_date', paymentLookAhead.toISOString().slice(0, 10))

    for (const inst of installments ?? []) {
      const client = (Array.isArray(inst.clients) ? inst.clients[0] : inst.clients) as unknown as { user_id: string; ig_username: string; full_name: string }
      if (await hasOpenTask('payment', undefined, inst.client_id)) continue

      const dueDate  = new Date(inst.due_date)
      const isPast   = dueDate < now
      const priority: TaskPriority = isPast ? 'overdue' : dueDate.toDateString() === now.toDateString() ? 'today' : 'this_week'
      const name     = client.ig_username || client.full_name

      const { error } = await supabase.from('tasks').insert({
        user_id:        user.id,
        type:           'payment',
        priority,
        title:          `Payment due — @${name}`,
        description:    `Instalment of ${inst.amount} due ${isPast ? 'on' : 'by'} ${dueDate.toLocaleDateString('en', { month: 'short', day: 'numeric' })}.`,
        lead_id:        null,
        client_id:      inst.client_id,
        due_at:         dueDate.toISOString(),
        completed:      false,
        completed_at:   null,
        auto_generated: true,
      })
      if (!error) created++
    }
  }

  // ── 3. Upsell tasks ──────────────────────────────────────────────────────────
  if (prefs.upsell_enabled) {
    const { data: clients } = await supabase
      .from('clients')
      .select('id, ig_username, full_name, started_at, plan_months, contract_end_date, upsell_reminder_set')
      .eq('user_id', user.id)
      .eq('active', true)
      .eq('upsell_reminder_set', false)

    for (const client of clients ?? []) {
      // Calculate the trigger date
      let triggerDate: Date | null = null

      if (prefs.upsell_timing === 'before_end') {
        // X months before contract ends
        const endDate = client.contract_end_date
          ? new Date(client.contract_end_date)
          : client.started_at && client.plan_months
            ? new Date(new Date(client.started_at).setMonth(new Date(client.started_at).getMonth() + client.plan_months))
            : null
        if (endDate) {
          triggerDate = new Date(endDate)
          triggerDate.setMonth(triggerDate.getMonth() - prefs.upsell_months)
        }
      } else {
        // X months after contract start
        if (client.started_at) {
          triggerDate = new Date(client.started_at)
          triggerDate.setMonth(triggerDate.getMonth() + prefs.upsell_months)
        }
      }

      if (!triggerDate || triggerDate > now) continue
      if (await hasOpenTask('upsell', undefined, client.id)) continue

      const name = client.ig_username || client.full_name
      const { error } = await supabase.from('tasks').insert({
        user_id:        user.id,
        type:           'upsell',
        priority:       'today',
        title:          `Upsell opportunity — @${name}`,
        description:    prefs.upsell_timing === 'before_end'
          ? `Contract ending soon — great time to discuss renewal or upgrade.`
          : `${prefs.upsell_months} month${prefs.upsell_months !== 1 ? 's' : ''} in — check in on results and explore next steps.`,
        lead_id:        null,
        client_id:      client.id,
        due_at:         now.toISOString(),
        completed:      false,
        completed_at:   null,
        auto_generated: true,
      })
      if (!error) {
        created++
        // Mark client so we don't create duplicate upsell tasks
        await supabase.from('clients').update({ upsell_reminder_set: true }).eq('id', client.id)
      }
    }
  }

  // ── Watching count (leads being monitored for follow-ups) ───────────────────
  const { count: watching } = await supabase
    .from('leads')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .in('stage', ['follower', 'replied', 'freebie_sent'])

  return NextResponse.json({ created, watching: watching ?? 0 })
}
