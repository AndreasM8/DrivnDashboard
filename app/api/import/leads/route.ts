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

  // Skip leads whose name already exists in this coach's pipeline
  const { data: existing } = await adminClient
    .from('leads')
    .select('full_name')
    .eq('user_id', uid)

  const existingNames = new Set((existing ?? []).map(l => l.full_name.toLowerCase().trim()))

  const toInsert = leads
    .filter(l => l.full_name && !existingNames.has(l.full_name.toLowerCase().trim()))
    .map(l => ({
      user_id:        uid,
      full_name:      l.full_name,
      ig_username:    l.ig_username || l.full_name,
      source:         l.source || 'Instagram',
      stage:          'closed' as const,
      call_booked_at: l.call_booked_at,
      call_outcome:   l.call_outcome,
      call_closed:    true,
      setter_notes:   '',
      call_notes:     '',
      last_contact_at: l.call_booked_at,
    }))

  const skipped = leads.length - toInsert.length

  if (toInsert.length === 0) {
    return NextResponse.json({ created: 0, skipped })
  }

  const { error } = await adminClient.from('leads').insert(toInsert)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ created: toInsert.length, skipped })
}
