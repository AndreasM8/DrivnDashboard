import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getEffectiveUserId } from '@/lib/admin'
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
  days_of_week: number[] | null
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
  recurrence: 'daily' | 'weekly' | null
  recurrence_days: number[] | null
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

// Compute how many consecutive days all applicable non-negs were completed
function computeNonNegStreak(
  items: NonNegotiable[],
  completions: { date: string; non_negotiable_id: string; completed: boolean }[],
  todayKey: string,
): number {
  if (items.length === 0) return 0

  // Group completions by date → set of completed item IDs
  const byDate = new Map<string, Set<string>>()
  for (const c of completions) {
    if (!c.completed) continue
    if (!byDate.has(c.date)) byDate.set(c.date, new Set())
    byDate.get(c.date)!.add(c.non_negotiable_id)
  }

  let streak = 0
  // Use UTC noon to avoid timezone-day mismatches when iterating
  const date = new Date(todayKey + 'T12:00:00Z')

  for (let i = 0; i < 60; i++) {
    const dateStr = date.toISOString().slice(0, 10)
    const dow = date.getUTCDay() // 0=Sun … 6=Sat

    // Items that apply on this day of week
    const applicable = items.filter(item => !item.days_of_week || item.days_of_week.includes(dow))

    if (applicable.length === 0) {
      // Nothing scheduled — skip without breaking streak
      date.setUTCDate(date.getUTCDate() - 1)
      continue
    }

    const done = byDate.get(dateStr) ?? new Set()
    const allDone = applicable.every(item => done.has(item.id))

    if (allDone) {
      streak++
    } else {
      break
    }

    date.setUTCDate(date.getUTCDate() - 1)
  }

  return streak
}

export default async function TasksPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const uid = await getEffectiveUserId()

  // Fetch profile first so we can compute the timezone-aware cycle date
  const { data: profile } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .single()

  const resetHour = (profile?.nonneg_reset_hour as number | null) ?? 0
  const timezone  = (profile?.timezone as string | null) ?? 'Europe/Oslo'
  const todayKey  = getNonNegTodayKey(timezone, resetHour)
  const today     = new Date().toISOString().slice(0, 10)

  // Approximate cycle start as UTC midnight of the cycle date (good enough for daily resets)
  const cycleStartIso = todayKey + 'T00:00:00.000Z'

  // Today's day-of-week in user's timezone (0=Sun…6=Sat)
  const todayDow = (() => {
    const fmt = new Intl.DateTimeFormat('en-US', { timeZone: timezone, weekday: 'short' })
    const day = fmt.format(new Date())
    return ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].indexOf(day)
  })()

  const streakFrom = (() => {
    const d = new Date(todayKey + 'T12:00:00Z')
    d.setUTCDate(d.getUTCDate() - 60)
    return d.toISOString().slice(0, 10)
  })()

  const [
    { data: nonNegotiables },
    { data: completions },
    { data: streakCompletions },
    { data: powerTasks },
    { data: tasks },
    { count: followupsCompletedToday },
  ] = await Promise.all([
    supabase.from('non_negotiables').select('*').eq('user_id', uid).eq('active', true).order('position'),
    supabase.from('non_negotiable_completions').select('*').eq('user_id', uid).eq('date', todayKey),
    supabase.from('non_negotiable_completions').select('date, non_negotiable_id, completed').eq('user_id', uid).gte('date', streakFrom),
    supabase.from('power_tasks').select('*').eq('user_id', uid)
      .or(`completed.eq.false,completed_at.gte.${cycleStartIso}`)
      .order('position'),
    supabase.from('tasks').select('*').eq('user_id', uid).eq('completed', false).order('due_at'),
    supabase.from('tasks').select('*', { count: 'exact', head: true })
      .eq('user_id', uid).eq('type', 'follow_up').eq('completed', true)
      .gte('completed_at', today + 'T00:00:00.000Z'),
  ])

  const allNonNeg = (nonNegotiables as NonNegotiable[]) ?? []
  const nonNegStreak = computeNonNegStreak(allNonNeg, streakCompletions ?? [], todayKey)

  return (
    <TasksClient
      userId={user.id}
      userName={profile?.name ?? ''}
      dailyFollowupTarget={profile?.daily_followup_target ?? 10}
      resetHour={resetHour}
      todayKey={todayKey}
      cycleStartIso={cycleStartIso}
      todayDow={todayDow}
      initialNonNeg={allNonNeg}
      initialCompletions={(completions as NonNegotiableCompletion[]) ?? []}
      initialPowerTasks={(powerTasks as PowerTask[]) ?? []}
      initialTasks={(tasks as Task[]) ?? []}
      followupsCompletedToday={followupsCompletedToday ?? 0}
      nonNegStreak={nonNegStreak}
    />
  )
}
