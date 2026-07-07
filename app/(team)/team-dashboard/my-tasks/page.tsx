import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getTeamSession } from '@/lib/team-auth'
import { redirect } from 'next/navigation'
import MyTasksClient from './MyTasksClient'
import type { TeamPersonalTask, TeamTask } from '@/types'

export default async function MyTasksPage() {
  const session = await getTeamSession()
  if (!session) redirect('/auth/login')

  const supabase = await createServerSupabaseClient()

  const [{ data: tasks }, { data: coachTasks }] = await Promise.all([
    supabase
      .from('team_personal_tasks')
      .select('*')
      .eq('team_member_id', session.member.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('team_tasks')
      .select('*')
      .eq('assigned_to', session.member.id)
      .order('created_at', { ascending: false }),
  ])

  return (
    <MyTasksClient
      memberId={session.member.id}
      initialTasks={(tasks ?? []) as TeamPersonalTask[]}
      coachTasks={(coachTasks ?? []) as TeamTask[]}
    />
  )
}
