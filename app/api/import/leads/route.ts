import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createAdminSupabaseClient } from '@/lib/supabase-admin'
import { getEffectiveUserId } from '@/lib/admin'
import type { ImportLeadRecord } from '@/lib/csv-parser'

// Stage priority — higher index = more advanced, never downgrade to a lower index
const STAGE_ORDER = ['follower', 'replied', 'freebie_sent', 'call_booked', 'second_call', 'nurture', 'not_interested', 'bad_fit', 'closed']
function stageRank(s: string) { const i = STAGE_ORDER.indexOf(s); return i === -1 ? 0 : i }

export async function POST(req: NextRequest): Promise<NextResponse> {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const uid = await getEffectiveUserId()
  const { leads } = await req.json() as { leads: ImportLeadRecord[] }

  if (!leads?.length) return NextResponse.json({ created: 0, skipped: 0, updated: 0 })

  const adminClient = createAdminSupabaseClient()

  // Fetch existing leads (paginated past 1000-row cap)
  const existing: { id: string; full_name: string; ig_username: string; stage: string }[] = []
  let from = 0
  while (true) {
    const { data, error } = await adminClient
      .from('leads')
      .select('id, full_name, ig_username, stage')
      .eq('user_id', uid)
      .range(from, from + 999)
    if (error || !data || data.length === 0) break
    existing.push(...data)
    if (data.length < 1000) break
    from += 1000
  }

  // Build lookup by normalised name/handle → { id, stage }
  const existingByKey = new Map<string, { id: string; stage: string }>()
  for (const l of existing) {
    if (l.full_name)   existingByKey.set(l.full_name.toLowerCase().trim(),   { id: l.id, stage: l.stage })
    if (l.ig_username) existingByKey.set(l.ig_username.toLowerCase().trim(), { id: l.id, stage: l.stage })
  }

  const toInsert: typeof leads = []
  const toUpdate: { id: string; stage: string; call_booked_at: string | null; call_outcome: string | null }[] = []

  for (const lead of leads) {
    if (!lead.full_name) continue
    const nameKey = lead.full_name.toLowerCase().trim()
    const igKey   = (lead.ig_username || '').toLowerCase().trim()
    const found   = existingByKey.get(nameKey) ?? (igKey ? existingByKey.get(igKey) : undefined)

    if (found) {
      // Only upgrade stage, never downgrade (closed stays closed)
      if (stageRank(lead.stage) > stageRank(found.stage)) {
        toUpdate.push({
          id:             found.id,
          stage:          lead.stage,
          call_booked_at: lead.call_booked_at,
          call_outcome:   lead.call_outcome,
        })
      }
    } else {
      toInsert.push(lead)
    }
  }

  // Batch updates
  if (toUpdate.length > 0) {
    await Promise.all(toUpdate.map(u =>
      adminClient.from('leads').update({
        stage:          u.stage,
        call_booked_at: u.call_booked_at ?? undefined,
        call_outcome:   u.call_outcome   ?? undefined,
        call_closed:    u.stage === 'closed',
        updated_at:     new Date().toISOString(),
      }).eq('id', u.id)
    ))
  }

  // Insert new leads
  let created = 0
  if (toInsert.length > 0) {
    const rows = toInsert.map(l => ({
      user_id:        uid,
      full_name:      l.full_name,
      ig_username:    l.ig_username || l.full_name,
      source:         l.source || 'Instagram',
      stage:          l.stage,
      followed_at:    l.followed_at,
      call_booked_at: l.call_booked_at,
      call_outcome:   l.call_outcome,
      call_closed:    l.stage === 'closed',
      setter_notes:   '',
      call_notes:     '',
      last_contact_at: l.call_booked_at ?? l.followed_at,
    }))
    const { error } = await adminClient.from('leads').insert(rows)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    created = rows.length
  }

  return NextResponse.json({ created, updated: toUpdate.length, skipped: leads.length - toInsert.length - toUpdate.length })
}
