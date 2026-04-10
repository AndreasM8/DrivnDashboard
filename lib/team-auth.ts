import { createServerSupabaseClient } from './supabase-server'
import type { TeamMember } from '@/types'

export interface TeamSession {
  member: TeamMember
  coachId: string
}

export async function getTeamSession(): Promise<TeamSession | null> {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('team_members')
    .select('*')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .maybeSingle()

  if (!data) return null
  return { member: data as TeamMember, coachId: data.coach_id }
}
