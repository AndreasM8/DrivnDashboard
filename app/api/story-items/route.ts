import { createServerSupabaseClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  // Fetch active items (one-time items that are older than today are excluded client-side)
  const { data: items } = await supabase
    .from('story_items').select('*').eq('user_id', user.id).eq('active', true)
    .order('created_at', { ascending: true })
  // Fetch posts from last 14 days
  const since = new Date(); since.setDate(since.getDate() - 14)
  const { data: posts } = await supabase
    .from('story_item_posts').select('*').eq('user_id', user.id)
    .gte('posted_date', since.toISOString().slice(0, 10))
  return NextResponse.json({ items: items ?? [], posts: posts ?? [] })
}

export async function POST(req: Request) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json() as { title: string; repeat_days: number[] | null; one_time_date: string | null }
  const { data } = await supabase.from('story_items')
    .insert({ ...body, user_id: user.id }).select().single()
  return NextResponse.json({ item: data })
}
