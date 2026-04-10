import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getTeamSession } from '@/lib/team-auth'
import { redirect } from 'next/navigation'
import MyTasksClient from './MyTasksClient'
import type { TeamPersonalTask } from '@/types'

export default async function MyTasksPage() {
  const session = await getTeamSession()
  if (!session) redirect('/auth/login')

  const supabase = await createServerSupabaseClient()

  const { data: tasks } = await supabase
    .from('team_personal_tasks')
    .select('*')
    .eq('team_member_id', session.member.id)
    .order('created_at', { ascending: false })

  return (
    <MyTasksClient
      memberId={session.member.id}
      initialTasks={(tasks ?? []) as TeamPersonalTask[]}
    />
  )
}
