import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getTeamSession } from '@/lib/team-auth'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export async function POST(request: NextRequest) {
  const session = await getTeamSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!session.member.permissions?.pipeline) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json() as {
    ig_username: string
    full_name?: string
    stage?: string
    setter_id?: string | null
    setter_notes?: string
    last_contact_at?: string
  }

  if (!body.ig_username) {
    return NextResponse.json({ error: 'ig_username required' }, { status: 400 })
  }

  const { data, error } = await admin
    .from('leads')
    .insert({
      user_id: session.coachId,
      ig_username: body.ig_username.replace('@', ''),
      full_name: body.full_name ?? '',
      stage: body.stage ?? 'follower',
      setter_id: body.setter_id ?? null,
      setter_notes: body.setter_notes ?? '',
      last_contact_at: body.last_contact_at ?? new Date().toISOString(),
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Log history
  await admin.from('lead_history').insert({
    lead_id: (data as { id: string }).id,
    action: 'Lead added by team member',
    actor: session.member.name,
  })

  return NextResponse.json({ lead: data }, { status: 201 })
}
