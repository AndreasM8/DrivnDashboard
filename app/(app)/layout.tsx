import { createServerSupabaseClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import Sidebar from '@/components/ui/Sidebar'
import BottomNav from '@/components/ui/BottomNav'
import MobileHeader from '@/components/ui/MobileHeader'
import ViewAsBanner from '@/components/ui/ViewAsBanner'
import NavigationProgress from '@/components/ui/NavigationProgress'
import CheckinGate from '@/components/ui/CheckinGate'
import LanguageProvider from '@/components/providers/LanguageProvider'
import type { AdminViewAs, WeeklyCheckin, Language } from '@/types'

function getWeekBounds(date: Date = new Date()): { weekStart: string; weekEnd: string } {
  const d = new Date(date)
  const day = d.getUTCDay()
  const diff = day === 0 ? -6 : 1 - day
  const monday = new Date(d)
  monday.setUTCDate(d.getUTCDate() + diff)
  const sunday = new Date(monday)
  sunday.setUTCDate(monday.getUTCDate() + 6)
  return {
    weekStart: monday.toISOString().slice(0, 10),
    weekEnd:   sunday.toISOString().slice(0, 10),
  }
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  const cookieStore = await cookies()
  const viewAsRaw = cookieStore.get('drivn_view_as')?.value ?? null
  let viewAs: AdminViewAs | null = null
  if (viewAsRaw) {
    try { viewAs = JSON.parse(viewAsRaw) as AdminViewAs } catch { /* ignore */ }
  }

  const now = new Date()
  const { weekStart, weekEnd } = getWeekBounds(now)

  const [
    { count: taskCount },
    { data: teamMembership },
    { data: profile },
    { data: thisWeekCheckin },
  ] = await Promise.all([
    supabase
      .from('tasks')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('completed', false)
      .in('priority', ['overdue', 'today']),
    supabase
      .from('team_members')
      .select('id')
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle(),
    supabase
      .from('users')
      .select('role, checkin_enabled, checkin_day, base_currency, language')
      .eq('id', user.id)
      .single(),
    supabase
      .from('weekly_checkins')
      .select('*')
      .eq('user_id', user.id)
      .eq('week_start', weekStart)
      .maybeSingle(),
  ])

  const badge = taskCount ?? 0
  const isOwner = !teamMembership?.id
  const isAdmin = profile?.role === 'admin'

  // Strip view-as if current user is not actually admin (tamper protection)
  if (viewAs && !isAdmin) viewAs = null

  // ── Check-in gate ─────────────────────────────────────────────────────────
  const checkinEnabled  = (profile as Record<string, unknown> | null)?.checkin_enabled !== false
  const checkinDay      = ((profile as Record<string, unknown> | null)?.checkin_day as number | null) ?? 0
  const currency        = ((profile as Record<string, unknown> | null)?.base_currency as string | null) ?? 'NOK'
  const language        = (((profile as Record<string, unknown> | null)?.language as Language | null) ?? 'en') as Language
  const existingCheckin = (thisWeekCheckin as WeeklyCheckin | null)
  const alreadySubmitted = !!existingCheckin?.submitted_at

  // Determine if the check-in day for this week has arrived
  // checkin_day: 0=Sun, 1=Mon, 2=Tue, ... 6=Sat
  // weekStart is Monday. Convert checkin_day to offset from Monday.
  const weekStartDate = new Date(weekStart + 'T00:00:00Z')
  const daysFromMonday = checkinDay === 0 ? 6 : checkinDay - 1
  const checkinDayDate = new Date(weekStartDate)
  checkinDayDate.setUTCDate(weekStartDate.getUTCDate() + daysFromMonday)

  const needsCheckin =
    !isAdmin &&
    checkinEnabled &&
    !alreadySubmitted &&
    now >= checkinDayDate

  const isLastCheckinOfMonth = new Date(weekEnd).getMonth() !== new Date(new Date(weekEnd).getTime() + 7 * 24 * 60 * 60 * 1000).getMonth()

  return (
    <LanguageProvider language={language}>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <NavigationProgress />
        {viewAs && <ViewAsBanner coachName={viewAs.coachName} />}
        {needsCheckin && (
          <CheckinGate
            weekStart={weekStart}
            weekEnd={weekEnd}
            currency={currency}
            existingCheckin={existingCheckin}
            isLastCheckinOfMonth={isLastCheckinOfMonth}
          />
        )}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          <Sidebar taskBadge={badge} isOwner={isOwner} isAdmin={isAdmin} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <MobileHeader isOwner={isOwner} />
            <main className="flex-1 overflow-y-auto pb-20 md:pb-0" style={{ background: 'var(--bg-base)' }}>
              {children}
            </main>
          </div>
          <BottomNav taskBadge={badge} isOwner={isOwner} />
        </div>
      </div>
    </LanguageProvider>
  )
}
