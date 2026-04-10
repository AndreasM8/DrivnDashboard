import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getTeamSession } from '@/lib/team-auth'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getTeamSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await request.json() as { done?: boolean; title?: string; priority?: string }
  const supabase = await createServerSupabaseClient()

  const update: Record<string, unknown> = {}
  if (body.done !== undefined) {
    update.done = body.done
    update.done_at = body.done ? new Date().toISOString() : null
  }
  if (body.title !== undefined) update.title = body.title
  if (body.priority !== undefined) update.priority = body.priority

  const { error } = await supabase
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
  const supabase = await createServerSupabaseClient()

  const { error } = await supabase
    .from('team_personal_tasks')
    .delete()
    .eq('id', id)
    .eq('team_member_id', session.member.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
