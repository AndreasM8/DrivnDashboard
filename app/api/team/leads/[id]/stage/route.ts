import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getTeamSession } from '@/lib/team-auth'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getTeamSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Verify member has pipeline permission
  if (!session.member.permissions?.pipeline) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const body = await request.json() as { stage: string }
  if (!body.stage) return NextResponse.json({ error: 'stage required' }, { status: 400 })

  // Verify the lead belongs to the coach
  const { data: lead } = await admin
    .from('leads')
    .select('id, user_id')
    .eq('id', id)
    .eq('user_id', session.coachId)
    .maybeSingle()

  if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 })

  const now = new Date().toISOString()
  const { error } = await admin
    .from('leads')
    .update({ stage: body.stage, updated_at: now })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Log history
  await admin.from('lead_history').insert({
    lead_id: id,
    action: `Stage moved to ${body.stage}`,
    actor: session.member.name,
  })

  return NextResponse.json({ ok: true })
}
