import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getTeamSession } from '@/lib/team-auth'
import { redirect } from 'next/navigation'
import NonNegClient from './NonNegClient'
import type { TeamNonNeg } from '@/types'

export default async function NonNegPage() {
  const session = await getTeamSession()
  if (!session) redirect('/auth/login')

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

  const completedIds = (completions ?? []).map(c => c.non_neg_id as string)

  return (
    <NonNegClient
      nonNegs={(nonNegs ?? []) as TeamNonNeg[]}
      initialCompletedIds={completedIds}
      today={today}
    />
  )
}
