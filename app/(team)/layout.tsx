import { redirect } from 'next/navigation'
import { getTeamSession } from '@/lib/team-auth'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import TeamSidebar from '@/components/team/TeamSidebar'
import EodGate from '@/components/team/EodGate'
import WeeklyCheckinGate from '@/components/team/WeeklyCheckinGate'
import type { TeamCheckinTemplate } from '@/types'

function getThisWeekStart(): string {
  const now = new Date()
  const dayOfWeek = now.getUTCDay() // 0 = Sunday
  const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1
  const monday = new Date(now)
  monday.setUTCDate(now.getUTCDate() - daysToMonday)
  monday.setUTCHours(0, 0, 0, 0)
  return monday.toISOString().slice(0, 10)
}

function getThisWeekEnd(weekStart: string): string {
  const monday = new Date(weekStart)
  const sunday = new Date(monday)
  sunday.setUTCDate(monday.getUTCDate() + 6)
  return sunday.toISOString().slice(0, 10)
}

export default async function TeamLayout({ children }: { children: React.ReactNode }) {
  const session = await getTeamSession()
  if (!session) redirect('/auth/login')

  const supabase = await createServerSupabaseClient()
  const today = new Date().toISOString().slice(0, 10)
  const nowHour = new Date().getHours()
  const nowDayOfWeek = new Date().getDay() // 0 = Sun, 1 = Mon, ...

  const thisWeekStart = getThisWeekStart()
  const thisWeekEnd = getThisWeekEnd(thisWeekStart)

  // Fetch EOD template, today's EOD submission, weekly template, and this week's weekly submission
  const [
    { data: eodTemplateData },
    { data: eodData },
    { data: weeklyTemplateData },
    { data: weeklySubmission },
  ] = await Promise.all([
    supabase
      .from('team_checkin_templates')
      .select('*')
      .eq('team_member_id', session.member.id)
      .eq('type', 'eod')
      .maybeSingle(),
    supabase
      .from('team_eod_reports')
      .select('id')
      .eq('team_member_id', session.member.id)
      .eq('date', today)
      .maybeSingle(),
    supabase
      .from('team_checkin_templates')
      .select('*')
      .eq('team_member_id', session.member.id)
      .eq('type', 'weekly')
      .maybeSingle(),
    supabase
      .from('team_weekly_checkins')
      .select('id')
      .eq('team_member_id', session.member.id)
      .eq('week_start', thisWeekStart)
      .maybeSingle(),
  ])

  const eodTemplate = eodTemplateData as TeamCheckinTemplate | null
  const weeklyTemplate = weeklyTemplateData as TeamCheckinTemplate | null

  const eodHour = eodTemplate?.eod_hour ?? 20
  const eodSubmittedToday = !!eodData
  const shouldShowEodGate = !eodSubmittedToday && nowHour >= eodHour && (eodTemplate?.questions?.length ?? 0) > 0

  // Weekly gate: only show if weekly_enabled, not submitted yet, and today matches the configured day
  const isWeeklyCheckinDay = weeklyTemplate?.weekly_enabled
    ? nowDayOfWeek === (weeklyTemplate.weekly_day ?? 1)
    : false
  const needsWeeklyCheckin = weeklyTemplate?.weekly_enabled && !weeklySubmission && isWeeklyCheckinDay
  // EOD takes priority — only show weekly if EOD is already done (or not due)
  const shouldShowWeeklyGate =
    needsWeeklyCheckin &&
    !shouldShowEodGate &&
    (weeklyTemplate?.questions?.length ?? 0) > 0

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-base)' }}>
      <TeamSidebar member={session.member} />
      <main style={{ flex: 1, padding: '24px 24px 88px', maxWidth: '100%', overflowX: 'hidden' }}>
        {children}
      </main>

      {shouldShowEodGate && (
        <EodGate
          member={session.member}
          questions={eodTemplate?.questions ?? []}
          today={today}
        />
      )}

      {shouldShowWeeklyGate && (
        <WeeklyCheckinGate
          member={session.member}
          questions={weeklyTemplate?.questions ?? []}
          weekStart={thisWeekStart}
          weekEnd={thisWeekEnd}
        />
      )}
    </div>
  )
}
