import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createAdminSupabaseClient } from '@/lib/supabase-admin'
import { getEffectiveUserId } from '@/lib/admin'
import type { ImportLeadRecord } from '@/lib/csv-parser'

export async function POST(req: NextRequest): Promise<NextResponse> {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const uid = await getEffectiveUserId()
  const { leads } = await req.json() as { leads: ImportLeadRecord[] }

  if (!leads?.length) return NextResponse.json({ created: 0, skipped: 0 })

  const adminClient = createAdminSupabaseClient()

  // Dedup against existing leads by both full_name and ig_username
  const { data: existing } = await adminClient
    .from('leads')
    .select('full_name, ig_username')
    .eq('user_id', uid)

  const existingKeys = new Set<string>()
  for (const l of existing ?? []) {
    if (l.full_name)   existingKeys.add(l.full_name.toLowerCase().trim())
    if (l.ig_username) existingKeys.add(l.ig_username.toLowerCase().trim())
  }

  const toInsert = leads
    .filter(l => {
      if (!l.full_name) return false
      const name = l.full_name.toLowerCase().trim()
      const ig   = (l.ig_username || '').toLowerCase().trim()
      return !existingKeys.has(name) && (!ig || !existingKeys.has(ig))
    })
    .map(l => ({
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

  const skipped = leads.length - toInsert.length

  if (toInsert.length === 0) {
    return NextResponse.json({ created: 0, skipped })
  }

  const { error } = await adminClient.from('leads').insert(toInsert)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ created: toInsert.length, skipped })
}
