import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getTeamSession } from '@/lib/team-auth'

export async function GET() {
  const session = await getTeamSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = await createServerSupabaseClient()
  const today = new Date().toISOString().slice(0, 10)

  const [{ data: nonNegs }, { data: completions }] = await Promise.all([
    supabase
      .from('team_non_negotiables')
      .select('*')
      .eq('team_member_id', session.member.id)
      .order('order_index'),
    supabase
      .from('team_nonneg_completions')
      .select('non_neg_id')
      .eq('team_member_id', session.member.id)
      .eq('date', today),
  ])

  return NextResponse.json({
    non_negs: nonNegs ?? [],
    completed_ids: (completions ?? []).map(c => c.non_neg_id),
  })
}
