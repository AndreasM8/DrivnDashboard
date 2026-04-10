import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getTeamSession } from '@/lib/team-auth'
import { redirect } from 'next/navigation'
import TeamOverviewClient from './TeamOverviewClient'
import type { TeamNonNeg, TeamTask, TeamPersonalTask, TeamEodReport } from '@/types'

export default async function TeamDashboardPage() {
  const session = await getTeamSession()
  if (!session) redirect('/auth/login')

  const supabase = await createServerSupabaseClient()
  const today = new Date().toISOString().slice(0, 10)

  const [
    { data: nonNegs },
    { data: completions },
    { data: teamTasks },
    { data: personalTasks },
    { data: todayEod },
  ] = await Promise.all([
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
    supabase
      .from('team_tasks')
      .select('*')
      .eq('coach_id', session.coachId)
      .eq('done', false)
      .order('created_at', { ascending: false }),
    supabase
      .from('team_personal_tasks')
      .select('*')
      .eq('team_member_id', session.member.id)
      .eq('done', false)
      .order('created_at', { ascending: false }),
    supabase
      .from('team_eod_reports')
      .select('id, submitted_at')
      .eq('team_member_id', session.member.id)
      .eq('date', today)
      .maybeSingle(),
  ])

  const completedIds = new Set((completions ?? []).map(c => c.non_neg_id as string))
  const totalNonNegs = (nonNegs ?? []).length
  const completedNonNegs = (nonNegs ?? []).filter(n => completedIds.has(n.id as string)).length

  return (
    <TeamOverviewClient
      member={session.member}
      nonNegs={(nonNegs ?? []) as TeamNonNeg[]}
      completedNonNegIds={[...completedIds]}
      totalNonNegs={totalNonNegs}
      completedNonNegs={completedNonNegs}
      openTeamTasks={(teamTasks ?? []) as TeamTask[]}
      openPersonalTasks={(personalTasks ?? []) as TeamPersonalTask[]}
      eodSubmitted={!!(todayEod as TeamEodReport | null)?.submitted_at}
      today={today}
    />
  )
}
