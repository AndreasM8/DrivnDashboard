import { createServerSupabaseClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import TeamClient from './TeamClient'
import type { TeamMember } from '@/types'
import type { AdminViewAs } from '@/types'

export default async function TeamPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const cookieStore = await cookies()
  const viewAsRaw = cookieStore.get('drivn_view_as')?.value ?? null
  let viewAs: AdminViewAs | null = null
  if (viewAsRaw) {
    try { viewAs = JSON.parse(viewAsRaw) as AdminViewAs } catch { /* ignore */ }
  }
  const effectiveCoachId = viewAs?.coachId ?? user.id

  const { data: members } = await supabase
    .from('team_members')
    .select('*')
    .eq('coach_id', effectiveCoachId)
    .order('created_at')

  return (
    <TeamClient
      userId={effectiveCoachId}
      initialMembers={(members as TeamMember[]) ?? []}
    />
  )
}
