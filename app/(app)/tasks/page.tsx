import { createServerSupabaseClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import TasksClient from './TasksClient'
import type { Task } from '@/types'

export interface NonNegotiable {
  id: string
  user_id: string
  title: string
  position: number
  active: boolean
  created_at: string
}

export interface NonNegotiableCompletion {
  id: string
  user_id: string
  non_negotiable_id: string
  date: string
  completed: boolean
  completed_at: string | null
}

export interface PowerTask {
  id: string
  user_id: string
  title: string
  category: 'product' | 'content' | 'operations' | 'personal'
  due_date: string | null
  completed: boolean
  completed_at: string | null
  position: number
  created_at: string
}

export default async function TasksPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const today = new Date().toISOString().slice(0, 10)

  const [
    { data: profile },
    { data: nonNegotiables },
    { data: completions },
    { data: powerTasks },
    { data: tasks },
    { count: followupsCompletedToday },
  ] = await Promise.all([
    supabase.from('users').select('name, daily_followup_target').eq('id', user.id).single(),
    supabase.from('non_negotiables').select('*').eq('user_id', user.id).eq('active', true).order('position'),
    supabase.from('non_negotiable_completions').select('*').eq('user_id', user.id).eq('date', today),
    supabase.from('power_tasks').select('*').eq('user_id', user.id).eq('completed', false).order('position'),
    supabase.from('tasks').select('*').eq('user_id', user.id).eq('completed', false).order('due_at'),
    supabase.from('tasks').select('*', { count: 'exact', head: true })
      .eq('user_id', user.id).eq('type', 'follow_up').eq('completed', true)
      .gte('completed_at', today + 'T00:00:00.000Z'),
  ])

  return (
    <TasksClient
      userId={user.id}
      userName={profile?.name ?? ''}
      dailyFollowupTarget={profile?.daily_followup_target ?? 10}
      initialNonNeg={(nonNegotiables as NonNegotiable[]) ?? []}
      initialCompletions={(completions as NonNegotiableCompletion[]) ?? []}
      initialPowerTasks={(powerTasks as PowerTask[]) ?? []}
      initialTasks={(tasks as Task[]) ?? []}
      followupsCompletedToday={followupsCompletedToday ?? 0}
    />
  )
}
