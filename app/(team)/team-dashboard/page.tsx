import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createClient } from '@supabase/supabase-js'
import { getTeamSession } from '@/lib/team-auth'
import { redirect } from 'next/navigation'
import TeamOverviewClient from './TeamOverviewClient'
import type { TeamNonNeg, TeamTask, TeamPersonalTask, TeamCheckinTemplate, CheckinQuestion } from '@/types'

// Admin client — bypasses RLS for reads that team member auth can't reach
const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

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

  // 30-day window for history
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29)
  const historyFrom = thirtyDaysAgo.toISOString().slice(0, 10)

  // 14-day window for streak
  const fourteenDaysAgo = new Date()
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 13)
  const streakFrom = fourteenDaysAgo.toISOString().slice(0, 10)

  const [
    { data: nonNegs },
    { data: completions },
    { data: recentCompletions },
    { data: teamTasks },
    { data: personalTasks },
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
      .from('team_checkin_templates')
      .select('eod_hour, questions')
      .eq('team_member_id', session.member.id)
      .eq('type', 'eod')
      .maybeSingle(),
  ])

  // Use admin client to bypass RLS on EOD reports (team_member_id ≠ auth.uid())
  const { data: eodHistoryRaw } = await adminSupabase
    .from('team_eod_reports')
    .select('date, answers, submitted_at')
    .eq('team_member_id', session.member.id)
    .gte('date', historyFrom)
    .lte('date', today)
    .order('date', { ascending: false })

  const eodHistory = (eodHistoryRaw ?? []) as Array<{
    date: string
    submitted_at: string
    answers: Array<{ question_id: string; value: string | number | boolean }>
  }>

  const todayReport = eodHistory.find(r => r.date === today)
  const eodSubmitted = !!(todayReport?.submitted_at)
  const eodAnswers = (todayReport?.answers ?? []) as Array<{
    question_id: string
    value: string | number | boolean
  }>

  const eodTemplate = eodTemplateData as Pick<TeamCheckinTemplate, 'eod_hour' | 'questions'> | null
  const eodQuestions = (eodTemplate?.questions ?? []) as CheckinQuestion[]

  const completedIds = new Set((completions ?? []).map(c => c.non_neg_id as string))
  const totalNonNegs = (nonNegs ?? []).length
  const completedNonNegs = (nonNegs ?? []).filter(n => completedIds.has(n.id as string)).length

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
      eodQuestions={eodQuestions}
      eodAnswers={eodAnswers}
      eodHistory={eodHistory}
      today={today}
      streak={streak}
    />
  )
}
