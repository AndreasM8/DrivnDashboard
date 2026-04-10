import { createServerSupabaseClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import TeamClient from './TeamClient'
import type { TeamMember } from '@/types'

export default async function TeamPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: members } = await supabase
    .from('team_members')
    .select('*')
    .eq('coach_id', user.id)
    .order('created_at')

  return (
    <TeamClient
      userId={user.id}
      initialMembers={(members as TeamMember[]) ?? []}
    />
  )
}
