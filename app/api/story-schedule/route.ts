import { createServerSupabaseClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data } = await supabase
    .from('weekly_story_schedule')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle()
  return NextResponse.json({ schedule: data })
}

export async function PUT(req: Request) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json() as Record<string, string>
  const { data } = await supabase
    .from('weekly_story_schedule')
    .upsert({ ...body, user_id: user.id, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
    .select()
    .single()
  return NextResponse.json({ schedule: data })
}
