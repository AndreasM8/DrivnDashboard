import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export async function GET() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: checkins, error } = await supabase
    .from('weekly_checkins')
    .select('*')
    .eq('user_id', user.id)
    .not('submitted_at', 'is', null)
    .order('week_start', { ascending: false })
    .limit(24)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ checkins: checkins ?? [] })
}

export async function POST(req: Request) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json() as Record<string, unknown>
  const { week_start, week_end, action, ...fields } = body as {
    week_start: string
    week_end: string
    action?: 'submit' | 'snooze' | 'draft'
    [key: string]: unknown
  }

  if (!week_start || !week_end) {
    return NextResponse.json({ error: 'week_start and week_end required' }, { status: 400 })
  }

  const upsertData: Record<string, unknown> = {
    user_id: user.id,
    week_start,
    week_end,
    ...fields,
  }

  if (action === 'submit') {
    upsertData.submitted_at = new Date().toISOString()
  } else if (action === 'snooze') {
    const tomorrow = new Date()
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1)
    tomorrow.setUTCHours(9, 0, 0, 0)
    upsertData.snoozed_until = tomorrow.toISOString()
  }

  const { data, error } = await supabase
    .from('weekly_checkins')
    .upsert(upsertData, { onConflict: 'user_id,week_start' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ checkin: data })
}
