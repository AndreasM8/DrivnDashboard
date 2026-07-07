import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getTeamSession } from '@/lib/team-auth'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getTeamSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await request.json() as { done?: boolean; title?: string; priority?: string }

  const update: Record<string, unknown> = {}
  if (body.done !== undefined) {
    update.done = body.done
    update.done_at = body.done ? new Date().toISOString() : null
  }
  if (body.title !== undefined) update.title = body.title
  if (body.priority !== undefined) update.priority = body.priority

  const { error } = await admin
    .from('team_personal_tasks')
    .update(update)
    .eq('id', id)
    .eq('team_member_id', session.member.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getTeamSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const { error } = await admin
    .from('team_personal_tasks')
    .delete()
    .eq('id', id)
    .eq('team_member_id', session.member.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
