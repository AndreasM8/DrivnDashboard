import { createServerSupabaseClient } from './supabase-server'
import { cookies } from 'next/headers'
import type { TeamMember } from '@/types'

export interface TeamSession {
  member: TeamMember
  coachId: string
}

export async function getTeamSession(): Promise<TeamSession | null> {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const cookieStore = await cookies()
  const activeWorkspaceId = cookieStore.get('drivn_active_workspace')?.value ?? null

  // Try the cookie-specified workspace first
  if (activeWorkspaceId) {
    const { data } = await supabase
      .from('team_members')
      .select('*')
      .eq('user_id', user.id)
      .eq('id', activeWorkspaceId)
      .eq('status', 'active')
      .maybeSingle()

    if (data) return { member: data as TeamMember, coachId: data.coach_id }
    // Cookie stale/invalid — fall through to default
  }

  // Fallback: oldest active membership
  const { data } = await supabase
    .from('team_members')
    .select('*')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .order('created_at')
    .limit(1)
    .maybeSingle()

  if (!data) return null
  return { member: data as TeamMember, coachId: data.coach_id }
}
