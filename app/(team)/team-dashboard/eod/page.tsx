import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getTeamSession } from '@/lib/team-auth'
import { redirect } from 'next/navigation'
import EodSubmitClient from './EodSubmitClient'
import type { TeamCheckinTemplate, TeamEodReport } from '@/types'

export default async function EodPage() {
  const session = await getTeamSession()
  if (!session) redirect('/auth/login')

  const supabase = await createServerSupabaseClient()
  const today = new Date().toISOString().slice(0, 10)

  const [{ data: template }, { data: existing }] = await Promise.all([
    supabase
      .from('team_checkin_templates')
      .select('*')
      .eq('team_member_id', session.member.id)
      .eq('type', 'eod')
      .maybeSingle(),
    supabase
      .from('team_eod_reports')
      .select('*')
      .eq('team_member_id', session.member.id)
      .eq('date', today)
      .maybeSingle(),
  ])

  return (
    <EodSubmitClient
      member={session.member}
      template={template as TeamCheckinTemplate | null}
      existing={existing as TeamEodReport | null}
      today={today}
    />
  )
}
