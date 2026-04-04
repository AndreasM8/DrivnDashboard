import { createServerSupabaseClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const since = new Date(); since.setDate(since.getDate() - 90)
  const { data } = await supabase
    .from('power_task_completions')
    .select('*')
    .eq('user_id', user.id)
    .gte('completed_date', since.toISOString().slice(0, 10))
    .order('completed_date', { ascending: false })
  return NextResponse.json({ completions: data ?? [] })
}

export async function POST(req: Request) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json() as { power_task_id: string; task_title: string; category: string; completed_date: string }
  const { data } = await supabase.from('power_task_completions').insert({ ...body, user_id: user.id }).select().single()
  return NextResponse.json({ completion: data })
}
