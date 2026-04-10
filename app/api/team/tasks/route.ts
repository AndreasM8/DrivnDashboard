import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import type { TeamTask } from '@/types'

export async function GET() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('team_tasks')
    .select('*')
    .eq('coach_id', user.id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ tasks: data })
}

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json() as Partial<TeamTask>
  if (!body.title) return NextResponse.json({ error: 'title required' }, { status: 400 })

  const { data, error } = await supabase
    .from('team_tasks')
    .insert({
      coach_id: user.id,
      title: body.title,
      description: body.description ?? null,
      priority: body.priority ?? 'this_week',
      assigned_to: body.assigned_to ?? null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ task: data }, { status: 201 })
}
