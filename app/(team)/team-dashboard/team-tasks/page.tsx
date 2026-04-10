import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getTeamSession } from '@/lib/team-auth'
import { redirect } from 'next/navigation'
import TeamTasksClient from './TeamTasksClient'
import type { TeamTask } from '@/types'

export default async function TeamTasksPage() {
  const session = await getTeamSession()
  if (!session) redirect('/auth/login')

  const supabase = await createServerSupabaseClient()

  const { data: tasks } = await supabase
    .from('team_tasks')
    .select('*')
    .eq('coach_id', session.coachId)
    .order('created_at', { ascending: false })

  return (
    <TeamTasksClient
      initialTasks={(tasks ?? []) as TeamTask[]}
    />
  )
}
