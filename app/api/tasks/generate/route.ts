import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import type { TaskPriority } from '@/types'

export async function POST() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const now = new Date()
  const threeDaysAgo = new Date(now.getTime() - 3 * 86400000).toISOString()

  // Fetch leads in follower or replied (incl. freebie_sent) that need follow-up
  const { data: leads, error: leadsError } = await supabase
    .from('leads')
    .select('id, ig_username, last_contact_at, stage')
    .eq('user_id', user.id)
    .in('stage', ['follower', 'replied', 'freebie_sent'])

  if (leadsError) {
    return NextResponse.json({ error: leadsError.message }, { status: 500 })
  }

  if (!leads || leads.length === 0) {
    return NextResponse.json({ created: 0 })
  }

  // Filter leads that haven't been contacted in 3+ days
  const staleLeads = leads.filter(l => {
    if (!l.last_contact_at) return true
    return new Date(l.last_contact_at) < new Date(threeDaysAgo)
  })

  if (staleLeads.length === 0) {
    return NextResponse.json({ created: 0 })
  }

  const staleLeadIds = staleLeads.map(l => l.id)

  // Find leads that already have an open follow-up task
  const { data: existingTasks } = await supabase
    .from('tasks')
    .select('lead_id')
    .eq('user_id', user.id)
    .eq('type', 'follow_up')
    .eq('completed', false)
    .in('lead_id', staleLeadIds)

  const alreadyTaskedLeadIds = new Set(
    (existingTasks ?? []).map(t => t.lead_id as string)
  )

  const leadsNeedingTasks = staleLeads.filter(l => !alreadyTaskedLeadIds.has(l.id))

  if (leadsNeedingTasks.length === 0) {
    return NextResponse.json({ created: 0 })
  }

  function getPriority(lastContactAt: string | null): TaskPriority {
    if (!lastContactAt) return 'today'
    const lastContact = new Date(lastContactAt)
    const diffDays = (now.getTime() - lastContact.getTime()) / 86400000
    if (diffDays > 7) return 'overdue'
    if (diffDays > 3) return 'today'
    return 'this_week'
  }

  const tasksToInsert = leadsNeedingTasks.map(l => ({
    user_id: user.id,
    type: 'follow_up' as const,
    priority: getPriority(l.last_contact_at),
    title: `Follow up — @${l.ig_username}`,
    description: `This lead has been in the ${l.stage} stage without contact for over 3 days.`,
    lead_id: l.id,
    client_id: null,
    due_at: now.toISOString(),
    completed: false,
    completed_at: null,
    auto_generated: true,
  }))

  const { data: inserted, error: insertError } = await supabase
    .from('tasks')
    .insert(tasksToInsert)
    .select()

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  return NextResponse.json({ created: inserted?.length ?? 0 })
}
