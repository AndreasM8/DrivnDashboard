import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getTeamSession } from '@/lib/team-auth'
import { redirect } from 'next/navigation'
import TeamOverviewClient from './TeamOverviewClient'
import type { TeamNonNeg, TeamTask, TeamPersonalTask, TeamEodReport, TeamCheckinTemplate } from '@/types'

function computeNonNegStreak(
  completions: Array<{ date: string; non_neg_id: string }>,
  totalNonNegs: number,
  today: string
): number {
  if (totalNonNegs === 0) return 0
  let streak = 0
  const check = new Date(today)
  for (let i = 0; i < 14; i++) {
    const dateStr = check.toISOString().slice(0, 10)
    const count = completions.filter(c => c.date === dateStr).length
    if (count >= totalNonNegs) {
      streak++
      check.setDate(check.getDate() - 1)
    } else {
      break
    }
  }
  return streak
}

export default async function TeamDashboardPage() {
  const session = await getTeamSession()
  if (!session) redirect('/auth/login')

  const supabase = await createServerSupabaseClient()
  const today = new Date().toISOString().slice(0, 10)
  const nowHour = new Date().getHours()

  // Date 14 days ago for streak calc
  const fourteenDaysAgo = new Date()
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 13)
  const streakFrom = fourteenDaysAgo.toISOString().slice(0, 10)

  const [
    { data: nonNegs },
    { data: completions },
    { data: recentCompletions },
    { data: teamTasks },
    { data: personalTasks },
    { data: todayEod },
    { data: eodTemplateData },
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
      .from('team_nonneg_completions')
      .select('date, non_neg_id')
      .eq('team_member_id', session.member.id)
      .gte('date', streakFrom)
      .lte('date', today),
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
    supabase
      .from('team_checkin_templates')
      .select('eod_hour')
      .eq('team_member_id', session.member.id)
      .eq('type', 'eod')
      .maybeSingle(),
  ])

  const eodTemplate = eodTemplateData as Pick<TeamCheckinTemplate, 'eod_hour'> | null
  const eodHour = eodTemplate?.eod_hour ?? 20

  const completedIds = new Set((completions ?? []).map(c => c.non_neg_id as string))
  const totalNonNegs = (nonNegs ?? []).length
  const completedNonNegs = (nonNegs ?? []).filter(n => completedIds.has(n.id as string)).length

  const eodSubmitted = !!(todayEod as TeamEodReport | null)?.submitted_at
  const shouldShowEodBanner = !eodSubmitted && nowHour >= eodHour

  const streak = computeNonNegStreak(
    (recentCompletions ?? []) as Array<{ date: string; non_neg_id: string }>,
    totalNonNegs,
    today
  )

  return (
    <TeamOverviewClient
      member={session.member}
      nonNegs={(nonNegs ?? []) as TeamNonNeg[]}
      completedNonNegIds={[...completedIds]}
      totalNonNegs={totalNonNegs}
      completedNonNegs={completedNonNegs}
      openTeamTasks={(teamTasks ?? []) as TeamTask[]}
      openPersonalTasks={(personalTasks ?? []) as TeamPersonalTask[]}
      eodSubmitted={eodSubmitted}
      shouldShowEodBanner={shouldShowEodBanner}
      today={today}
      streak={streak}
    />
  )
}
