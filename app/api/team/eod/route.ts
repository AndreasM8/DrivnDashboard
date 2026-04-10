import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getTeamSession } from '@/lib/team-auth'

export async function GET() {
  const session = await getTeamSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = await createServerSupabaseClient()
  const today = new Date().toISOString().slice(0, 10)

  const { data } = await supabase
    .from('team_eod_reports')
    .select('id, submitted_at')
    .eq('team_member_id', session.member.id)
    .eq('date', today)
    .maybeSingle()

  return NextResponse.json({ submitted: !!data?.submitted_at, report: data })
}

export async function POST(request: NextRequest) {
  const session = await getTeamSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json() as {
    date: string
    answers: Array<{ question_id: string; value: string | number | boolean }>
  }

  const supabase = await createServerSupabaseClient()

  const { data, error } = await supabase
    .from('team_eod_reports')
    .upsert({
      team_member_id: session.member.id,
      coach_id: session.coachId,
      date: body.date ?? new Date().toISOString().slice(0, 10),
      answers: body.answers,
      submitted_at: new Date().toISOString(),
    }, { onConflict: 'team_member_id,date' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ report: data }, { status: 201 })
}
