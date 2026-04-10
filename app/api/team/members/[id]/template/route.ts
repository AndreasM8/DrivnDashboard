import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { searchParams } = new URL(request.url)
  const type = searchParams.get('type') ?? 'eod'

  const { data, error } = await supabase
    .from('team_checkin_templates')
    .select('*')
    .eq('team_member_id', id)
    .eq('coach_id', user.id)
    .eq('type', type)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ template: data })
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await request.json() as {
    type: string
    questions: unknown[]
    weekly_enabled?: boolean
    weekly_day?: number
    eod_hour?: number
  }

  const { data, error } = await supabase
    .from('team_checkin_templates')
    .upsert({
      team_member_id: id,
      coach_id: user.id,
      type: body.type,
      questions: body.questions,
      weekly_enabled: body.weekly_enabled ?? false,
      weekly_day: body.weekly_day ?? 0,
      eod_hour: typeof body.eod_hour === 'number' ? Math.max(0, Math.min(23, body.eod_hour)) : 20,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'team_member_id,type' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ template: data })
}
