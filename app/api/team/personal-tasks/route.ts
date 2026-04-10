import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getTeamSession } from '@/lib/team-auth'

export async function GET() {
  const session = await getTeamSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('team_personal_tasks')
    .select('*')
    .eq('team_member_id', session.member.id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ tasks: data })
}

export async function POST(request: NextRequest) {
  const session = await getTeamSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json() as { title: string; priority?: string }
  if (!body.title) return NextResponse.json({ error: 'title required' }, { status: 400 })

  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('team_personal_tasks')
    .insert({
      team_member_id: session.member.id,
      title: body.title,
      priority: body.priority ?? 'this_week',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ task: data }, { status: 201 })
}
