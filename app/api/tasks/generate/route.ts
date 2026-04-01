import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { resolveNotifPrefs } from '@/types'
import type { TaskPriority } from '@/types'

export async function POST() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Load user's notification preferences
  const { data: profile } = await supabase
    .from('users')
    .select('notification_prefs')
    .eq('id', user.id)
    .single()

  const prefs = resolveNotifPrefs(profile?.notification_prefs)

  // Respect the user's follow-up toggle
  if (!prefs.followup_enabled) {
    return NextResponse.json({ created: 0 })
  }

  const now = new Date()
  const overdueCutoff = new Date(now.getTime() - prefs.overdue_days * 86400000).toISOString()

  // Per-tier cutoffs (days without contact)
  const tierCutoff = (days: number) => new Date(now.getTime() - days * 86400000).toISOString()
  const cutoffs: Record<1 | 2 | 3, string> = {
    1: tierCutoff(prefs.followup_days_tier1),
    2: tierCutoff(prefs.followup_days_tier2),
    3: tierCutoff(prefs.followup_days_tier3),
  }

  // Fetch leads in follower / replied / freebie_sent
  const { data: leads, error: leadsError } = await supabase
    .from('leads')
    .select('id, ig_username, last_contact_at, stage, tier')
    .eq('user_id', user.id)
    .in('stage', ['follower', 'replied', 'freebie_sent'])

  if (leadsError) return NextResponse.json({ error: leadsError.message }, { status: 500 })
  if (!leads?.length) return NextResponse.json({ created: 0, watching: 0 })

  // Filter leads that haven't been contacted since their tier's threshold
  const staleLeads = leads.filter(l => {
    const tier = (l.tier as 1 | 2 | 3) ?? 2
    const cutoff = cutoffs[tier] ?? cutoffs[2]
    if (!l.last_contact_at) return true
    return new Date(l.last_contact_at) < new Date(cutoff)
  })

  if (!staleLeads.length) return NextResponse.json({ created: 0, watching: leads.length })

  // Skip leads that already have an open follow-up task
  const { data: existingTasks } = await supabase
    .from('tasks')
    .select('lead_id')
    .eq('user_id', user.id)
    .eq('type', 'follow_up')
    .eq('completed', false)
    .in('lead_id', staleLeads.map(l => l.id))

  const alreadyTasked = new Set((existingTasks ?? []).map(t => t.lead_id as string))
  const leadsNeedingTasks = staleLeads.filter(l => !alreadyTasked.has(l.id))

  if (!leadsNeedingTasks.length) return NextResponse.json({ created: 0, watching: leads.length })

  function getPriority(lastContactAt: string | null): TaskPriority {
    if (!lastContactAt) return 'today'
    return new Date(lastContactAt) < new Date(overdueCutoff) ? 'overdue' : 'today'
  }

  const tasksToInsert = leadsNeedingTasks.map(l => {
    const tier = (l.tier as 1 | 2 | 3) ?? 2
    const days = tier === 1 ? prefs.followup_days_tier1
               : tier === 3 ? prefs.followup_days_tier3
               : prefs.followup_days_tier2
    return {
      user_id: user.id,
      type: 'follow_up' as const,
      priority: getPriority(l.last_contact_at),
      title: `Follow up — @${l.ig_username}`,
      description: `No contact for ${days}+ days (${l.stage}, tier ${tier}).`,
      lead_id: l.id,
      client_id: null,
      due_at: now.toISOString(),
      completed: false,
      completed_at: null,
      auto_generated: true,
    }
  })

  const { data: inserted, error: insertError } = await supabase
    .from('tasks')
    .insert(tasksToInsert)
    .select()

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 })

  return NextResponse.json({ created: inserted?.length ?? 0, watching: leads.length })
}
