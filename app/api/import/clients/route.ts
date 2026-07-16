import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createAdminSupabaseClient } from '@/lib/supabase-admin'
import { getEffectiveUserId } from '@/lib/admin'
import type { ImportClientRecord } from '@/lib/csv-parser'

export async function POST(req: NextRequest): Promise<NextResponse> {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const uid = await getEffectiveUserId()
  const { clients, currency } = await req.json() as {
    clients: ImportClientRecord[]
    currency: string
  }

  if (!clients?.length) return NextResponse.json({ created: 0, skipped: 0 })

  const adminClient = createAdminSupabaseClient()

  // ── Clients table: skip duplicates by full_name ───────────────────────────
  const { data: existingClients } = await adminClient
    .from('clients')
    .select('full_name')
    .eq('user_id', uid)

  const existingClientNames = new Set(
    (existingClients ?? []).map(c => c.full_name.toLowerCase().trim())
  )

  const toInsert = clients
    .filter(c => c.full_name && !existingClientNames.has(c.full_name.toLowerCase().trim()))
    .map(c => ({
      user_id:        uid,
      full_name:      c.full_name,
      ig_username:    c.full_name,
      email:          '',
      phone:          '',
      program_type:   c.program_type,
      payment_type:   c.payment_type,
      plan_months:    c.plan_months,
      monthly_amount: c.monthly_amount,
      total_amount:   c.total_amount,
      total_paid:     c.total_paid,
      currency:       currency || 'NOK',
      started_at:     c.started_at,
      active:         true,
      notes:          '',
      churn_reason:   '',
    }))

  const skipped = clients.length - toInsert.length

  if (toInsert.length > 0) {
    const { error } = await adminClient.from('clients').insert(toInsert)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // ── Leads table: update existing leads to closed, insert new closed leads ─
  // Fetch all leads for this user (paginate to bypass 1000 row cap)
  const allLeads: { id: string; full_name: string; ig_username: string; stage: string }[] = []
  let from = 0
  while (true) {
    const { data, error } = await adminClient
      .from('leads')
      .select('id, full_name, ig_username, stage')
      .eq('user_id', uid)
      .range(from, from + 999)
    if (error || !data || data.length === 0) break
    allLeads.push(...data)
    if (data.length < 1000) break
    from += 1000
  }

  // Build lookup by name (normalised)
  const leadByName = new Map<string, { id: string; stage: string }>()
  for (const l of allLeads) {
    if (l.full_name)   leadByName.set(l.full_name.toLowerCase().trim(),   { id: l.id, stage: l.stage })
    if (l.ig_username) leadByName.set(l.ig_username.toLowerCase().trim(), { id: l.id, stage: l.stage })
  }

  const toUpdateIds: string[]         = []
  const toInsertAsLeads: ImportClientRecord[] = []

  for (const c of clients) {
    const key = c.full_name.toLowerCase().trim()
    const existing = leadByName.get(key)
    if (existing) {
      // Already in pipeline — upgrade to closed if not already
      if (existing.stage !== 'closed') toUpdateIds.push(existing.id)
    } else {
      toInsertAsLeads.push(c)
    }
  }

  if (toUpdateIds.length > 0) {
    await adminClient
      .from('leads')
      .update({ stage: 'closed', call_closed: true, updated_at: new Date().toISOString() })
      .in('id', toUpdateIds)
  }

  if (toInsertAsLeads.length > 0) {
    await adminClient.from('leads').insert(
      toInsertAsLeads.map(c => ({
        user_id:        uid,
        full_name:      c.full_name,
        ig_username:    c.full_name,
        source:         'Sales import',
        stage:          'closed',
        call_closed:    true,
        followed_at:    null,
        call_booked_at: c.started_at,
        setter_notes:   '',
        call_notes:     '',
        last_contact_at: c.started_at,
      }))
    )
  }

  return NextResponse.json({
    created: toInsert.length,
    skipped,
    leadsUpdated: toUpdateIds.length,
    leadsCreated: toInsertAsLeads.length,
  })
}
