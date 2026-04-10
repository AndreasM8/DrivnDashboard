import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getTeamSession } from '@/lib/team-auth'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getTeamSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await request.json() as { done?: boolean }
  const supabase = await createServerSupabaseClient()

  const update: Record<string, unknown> = {}
  if (body.done !== undefined) {
    update.done = body.done
    update.done_at = body.done ? new Date().toISOString() : null
  }

  const { error } = await supabase
    .from('team_tasks')
    .update(update)
    .eq('id', id)
    .eq('coach_id', session.coachId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
