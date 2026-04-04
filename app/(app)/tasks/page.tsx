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

// Compute the "current cycle date" for non-negotiables.
// If the user's reset hour is e.g. 5 AM and it's currently 3 AM,
// we're still in the previous cycle — so return yesterday's date.
function getNonNegTodayKey(timezone: string, resetHour: number): string {
  // Get localised time parts via Intl
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', hour12: false,
  })
  const parts = fmt.formatToParts(new Date())
  const get = (type: string) => parts.find(p => p.type === type)?.value ?? ''
  const dateStr = `${get('year')}-${get('month')}-${get('day')}`
  const currentHour = parseInt(get('hour'), 10)

  if (currentHour < resetHour) {
    // Before today's reset — still in yesterday's cycle
    const d = new Date(`${dateStr}T12:00:00Z`)
    d.setUTCDate(d.getUTCDate() - 1)
    return d.toISOString().slice(0, 10)
  }
  return dateStr
}

export default async function TasksPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  // Fetch profile first so we can compute the timezone-aware cycle date
  const { data: profile } = await supabase
    .from('users')
    .select('name, daily_followup_target, nonneg_reset_hour, timezone')
    .eq('id', user.id)
    .single()

  const resetHour = (profile?.nonneg_reset_hour as number | null) ?? 0
  const timezone  = (profile?.timezone as string | null) ?? 'Europe/Oslo'
  const todayKey  = getNonNegTodayKey(timezone, resetHour)
  const today     = new Date().toISOString().slice(0, 10)

  const [
    { data: nonNegotiables },
    { data: completions },
    { data: powerTasks },
    { data: tasks },
    { count: followupsCompletedToday },
  ] = await Promise.all([
    supabase.from('non_negotiables').select('*').eq('user_id', user.id).eq('active', true).order('position'),
    supabase.from('non_negotiable_completions').select('*').eq('user_id', user.id).eq('date', todayKey),
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
      resetHour={resetHour}
      todayKey={todayKey}
      initialNonNeg={(nonNegotiables as NonNegotiable[]) ?? []}
      initialCompletions={(completions as NonNegotiableCompletion[]) ?? []}
      initialPowerTasks={(powerTasks as PowerTask[]) ?? []}
      initialTasks={(tasks as Task[]) ?? []}
      followupsCompletedToday={followupsCompletedToday ?? 0}
    />
  )
}
