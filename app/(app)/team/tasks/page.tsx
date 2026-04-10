import { createServerSupabaseClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import CoachTeamTasksClient from './CoachTeamTasksClient'
import type { TeamMember, TeamTask } from '@/types'

export default async function CoachTeamTasksPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const [{ data: tasks }, { data: members }] = await Promise.all([
    supabase
      .from('team_tasks')
      .select('*')
      .eq('coach_id', user.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('team_members')
      .select('id, name, role')
      .eq('coach_id', user.id)
      .eq('status', 'active'),
  ])

  return (
    <CoachTeamTasksClient
      initialTasks={(tasks ?? []) as TeamTask[]}
      members={(members ?? []) as Pick<TeamMember, 'id' | 'name' | 'role'>[]}
    />
  )
}
