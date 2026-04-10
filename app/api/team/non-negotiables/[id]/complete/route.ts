import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getTeamSession } from '@/lib/team-auth'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getTeamSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const supabase = await createServerSupabaseClient()
  const today = new Date().toISOString().slice(0, 10)

  const { error } = await supabase.from('team_nonneg_completions').upsert({
    team_member_id: session.member.id,
    non_neg_id: id,
    date: today,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getTeamSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const supabase = await createServerSupabaseClient()
  const today = new Date().toISOString().slice(0, 10)

  const { error } = await supabase
    .from('team_nonneg_completions')
    .delete()
    .eq('team_member_id', session.member.id)
    .eq('non_neg_id', id)
    .eq('date', today)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
