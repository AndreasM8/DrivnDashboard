import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import type { WeeklyCheckin } from '@/types'

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

export async function GET() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Verify admin role
  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Compute week bounds for last 4 weeks
  const now = new Date()
  const weeks: string[] = []
  for (let i = 0; i < 4; i++) {
    const d = new Date(now)
    d.setUTCDate(d.getUTCDate() - i * 7)
    const { weekStart } = getWeekBounds(d)
    weeks.push(weekStart)
  }

  const thisWeekStart = weeks[0]
  const lastWeekStart = weeks[1]

  const [
    { data: coaches },
    { data: checkins },
  ] = await Promise.all([
    supabase.from('users').select('id, name').eq('role', 'coach').order('name'),
    supabase.from('weekly_checkins')
      .select('*')
      .in('week_start', weeks),
  ])

  const allCheckins = (checkins ?? []) as WeeklyCheckin[]
  const coachList = (coaches ?? []) as Array<{ id: string; name: string }>

  const result = coachList.map(coach => {
    const coachCheckins = allCheckins.filter(c => c.user_id === coach.id)
    const thisWeek = coachCheckins.find(c => c.week_start === thisWeekStart) ?? null
    const lastWeek = coachCheckins.find(c => c.week_start === lastWeekStart) ?? null

    // Compute streak: consecutive submitted weeks going back from last week
    let streak = 0
    for (let i = 1; i < weeks.length; i++) {
      const wk = coachCheckins.find(c => c.week_start === weeks[i])
      if (wk?.submitted_at) {
        streak++
      } else {
        break
      }
    }

    const submittedCheckins = coachCheckins.filter(c => c.submitted_at)
    const happinessValues = submittedCheckins
      .map(c => c.happiness_rating)
      .filter((r): r is number => r !== null)
    const avgHappiness = happinessValues.length > 0
      ? Math.round((happinessValues.reduce((a, b) => a + b, 0) / happinessValues.length) * 10) / 10
      : null

    const lastSubmitted = submittedCheckins
      .sort((a, b) => new Date(b.submitted_at!).getTime() - new Date(a.submitted_at!).getTime())[0]
      ?.submitted_at ?? null

    return {
      userId: coach.id,
      name: coach.name,
      thisWeek,
      lastWeek,
      streak,
      avgHappiness,
      lastSubmitted,
    }
  })

  return NextResponse.json({ coaches: result, thisWeekStart, lastWeekStart })
}
