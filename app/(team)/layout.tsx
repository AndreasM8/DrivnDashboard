import { redirect } from 'next/navigation'
import { getTeamSession } from '@/lib/team-auth'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createClient } from '@supabase/supabase-js'
import TeamSidebar from '@/components/team/TeamSidebar'
import TeamBottomNav from '@/components/team/TeamBottomNav'
import EodGate from '@/components/team/EodGate'
import WeeklyCheckinGate from '@/components/team/WeeklyCheckinGate'
import type { TeamCheckinTemplate, TeamRole, WorkspaceSummary } from '@/types'

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

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

  // Fetch EOD/weekly templates + workspace list in parallel
  const [
    { data: eodTemplateData },
    { data: eodData },
    { data: weeklyTemplateData },
    { data: weeklySubmission },
    { data: allMembers },
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
    // All active memberships for this user (for workspace switcher)
    session.member.user_id
      ? adminSupabase
          .from('team_members')
          .select('id, coach_id, role')
          .eq('user_id', session.member.user_id)
          .eq('status', 'active')
          .order('created_at')
      : Promise.resolve({ data: null }),
  ])

  // Build workspace list — only fetch coach names if there are multiple workspaces
  let workspaces: WorkspaceSummary[] = []
  if (allMembers && allMembers.length > 1) {
    const coachIds = allMembers.map(m => m.coach_id as string)
    const { data: coaches } = await adminSupabase
      .from('users')
      .select('id, name, business_name')
      .in('id', coachIds)

    workspaces = allMembers.map(m => ({
      memberId: m.id as string,
      coachId: m.coach_id as string,
      coachName:
        coaches?.find(c => c.id === m.coach_id)?.business_name ||
        coaches?.find(c => c.id === m.coach_id)?.name ||
        'Unknown',
      role: m.role as TeamRole,
      isActive: m.id === session.member.id,
    }))
  }

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
      <TeamSidebar member={session.member} workspaces={workspaces} />
      <main
        className="nav-scroll-pad"
        style={{ flex: 1, paddingTop: 24, paddingLeft: 24, paddingRight: 24, maxWidth: '100%', overflowX: 'hidden' }}
      >
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
          questions={weeklyTemplate?.questions ?? []}
          weekStart={thisWeekStart}
          weekEnd={thisWeekEnd}
        />
      )}

      <TeamBottomNav member={session.member} />
    </div>
  )
}
