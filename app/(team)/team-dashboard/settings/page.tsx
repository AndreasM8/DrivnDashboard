import { getTeamSession } from '@/lib/team-auth'
import { redirect } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import TeamSettingsClient from './TeamSettingsClient'
import type { TeamRole, WorkspaceSummary } from '@/types'

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export default async function TeamSettingsPage() {
  const session = await getTeamSession()
  if (!session) redirect('/auth/login')

  let workspaces: WorkspaceSummary[] = []

  if (session.member.user_id) {
    const { data: allMembers } = await adminSupabase
      .from('team_members')
      .select('id, coach_id, role')
      .eq('user_id', session.member.user_id)
      .eq('status', 'active')
      .order('created_at')

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
  }

  return (
    <TeamSettingsClient member={session.member} workspaces={workspaces} />
  )
}
