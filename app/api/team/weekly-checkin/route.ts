import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getTeamSession } from '@/lib/team-auth'

function getWeekBounds(): { weekStart: string; weekEnd: string } {
  const now = new Date()
  const dayOfWeek = now.getUTCDay() // 0 = Sunday
  // Monday-based: if today is Sunday (0), go back 6 days; otherwise go back (dayOfWeek - 1) days
  const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1
  const monday = new Date(now)
  monday.setUTCDate(now.getUTCDate() - daysToMonday)
  monday.setUTCHours(0, 0, 0, 0)

  const sunday = new Date(monday)
  sunday.setUTCDate(monday.getUTCDate() + 6)

  return {
    weekStart: monday.toISOString().slice(0, 10),
    weekEnd: sunday.toISOString().slice(0, 10),
  }
}

export async function GET() {
  const session = await getTeamSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = await createServerSupabaseClient()
  const { weekStart, weekEnd } = getWeekBounds()

  const { data } = await supabase
    .from('team_weekly_checkins')
    .select('id, submitted_at')
    .eq('team_member_id', session.member.id)
    .eq('week_start', weekStart)
    .maybeSingle()

  return NextResponse.json({ submitted: !!data?.submitted_at, report: data, weekStart, weekEnd })
}

export async function POST(request: NextRequest) {
  const session = await getTeamSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json() as {
    answers: Array<{ question_id: string; value: string | number | boolean }>
  }

  const supabase = await createServerSupabaseClient()
  const { weekStart, weekEnd } = getWeekBounds()

  const { data, error } = await supabase
    .from('team_weekly_checkins')
    .upsert({
      team_member_id: session.member.id,
      coach_id: session.coachId,
      week_start: weekStart,
      week_end: weekEnd,
      answers: body.answers,
      submitted_at: new Date().toISOString(),
    }, { onConflict: 'team_member_id,week_start' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ report: data }, { status: 201 })
}
