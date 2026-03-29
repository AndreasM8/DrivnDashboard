import { createServerSupabaseClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import TasksClient from './TasksClient'
import type { Task } from '@/types'

export default async function TasksPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: tasks } = await supabase
    .from('tasks')
    .select('*')
    .eq('user_id', user.id)
    .eq('completed', false)
    .order('due_at')

  return <TasksClient initialTasks={(tasks as Task[]) ?? []} userId={user.id} />
}
