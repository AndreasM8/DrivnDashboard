import { createServerSupabaseClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import type { WeeklyCheckin } from '@/types'
import AdminCheckinsClient from './AdminCheckinsClient'

function getWeekBounds(date: Date = new Date()): { weekStart: string; weekEnd: string } {
  const d = new Date(date)
  const day = d.getUTCDay()
  const diff = day === 0 ? -6 : 1 - day
  const monday = new Date(d)
  monday.setUTCDate(d.getUTCDate() + diff)
  const sunday = new Date(monday)
  sunday.setUTCDate(monday.getUTCDate() + 6)
  return {
    weekStart: monday.toISOString().slice(0, 10),
    weekEnd: sunday.toISOString().slice(0, 10),
  }
}

export interface CoachCheckinStats {
  userId: string
  name: string
  thisWeek: WeeklyCheckin | null
  lastWeek: WeeklyCheckin | null
  streak: number
  avgHappiness: number | null
  lastSubmitted: string | null
}

export default async function AdminCheckinsPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  // Verify admin
  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if ((profile as { role?: string } | null)?.role !== 'admin') {
    redirect('/dashboard')
  }

  const now = new Date()
  const weeks: string[] = []
  for (let i = 0; i < 4; i++) {
    const d = new Date(now)
    d.setUTCDate(d.getUTCDate() - i * 7)
    weeks.push(getWeekBounds(d).weekStart)
  }

  const thisWeekStart = weeks[0]
  const lastWeekStart = weeks[1]

  const [
    { data: coaches },
    { data: checkins },
  ] = await Promise.all([
    supabase.from('users').select('id, name').eq('role', 'coach').order('name'),
    supabase.from('weekly_checkins').select('*').in('week_start', weeks),
  ])

  const allCheckins = (checkins ?? []) as WeeklyCheckin[]
  const coachList = (coaches ?? []) as Array<{ id: string; name: string }>

  const stats: CoachCheckinStats[] = coachList.map(coach => {
    const coachCheckins = allCheckins.filter(c => c.user_id === coach.id)
    const thisWeek = coachCheckins.find(c => c.week_start === thisWeekStart) ?? null
    const lastWeek = coachCheckins.find(c => c.week_start === lastWeekStart) ?? null

    let streak = 0
    for (let i = 1; i < weeks.length; i++) {
      const wk = coachCheckins.find(c => c.week_start === weeks[i])
      if (wk?.submitted_at) streak++
      else break
    }

    const submitted = coachCheckins.filter(c => c.submitted_at)
    const happinessValues = submitted.map(c => c.happiness_rating).filter((r): r is number => r !== null)
    const avgHappiness = happinessValues.length > 0
      ? Math.round((happinessValues.reduce((a, b) => a + b, 0) / happinessValues.length) * 10) / 10
      : null

    const lastSubmitted = submitted
      .sort((a, b) => new Date(b.submitted_at!).getTime() - new Date(a.submitted_at!).getTime())[0]
      ?.submitted_at ?? null

    return { userId: coach.id, name: coach.name, thisWeek, lastWeek, streak, avgHappiness, lastSubmitted }
  })

  return (
    <AdminCheckinsClient
      stats={stats}
      thisWeekStart={thisWeekStart}
      lastWeekStart={lastWeekStart}
    />
  )
}
