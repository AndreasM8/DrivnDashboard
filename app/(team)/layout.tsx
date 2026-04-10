import { redirect } from 'next/navigation'
import { getTeamSession } from '@/lib/team-auth'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import TeamSidebar from '@/components/team/TeamSidebar'
import EodGate from '@/components/team/EodGate'
import type { TeamCheckinTemplate } from '@/types'

export default async function TeamLayout({ children }: { children: React.ReactNode }) {
  const session = await getTeamSession()
  if (!session) redirect('/auth/login')

  const supabase = await createServerSupabaseClient()
  const today = new Date().toISOString().slice(0, 10)
  const nowHour = new Date().getHours()

  // Fetch EOD template and today's submission in parallel
  const [{ data: templateData }, { data: eodData }] = await Promise.all([
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
  ])

  const template = templateData as TeamCheckinTemplate | null
  const eodHour = template?.eod_hour ?? 20
  const eodSubmittedToday = !!eodData
  const shouldShowGate = !eodSubmittedToday && nowHour >= eodHour && (template?.questions?.length ?? 0) > 0

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-base)' }}>
      <TeamSidebar member={session.member} />
      <main style={{ flex: 1, padding: '24px 24px 88px', maxWidth: '100%', overflowX: 'hidden' }}>
        {children}
      </main>

      {shouldShowGate && (
        <EodGate
          member={session.member}
          questions={template?.questions ?? []}
          today={today}
        />
      )}
    </div>
  )
}
