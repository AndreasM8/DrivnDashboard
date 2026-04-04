import { createServerSupabaseClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const { posted_date, posted } = await req.json() as { posted_date: string; posted: boolean }
  if (posted) {
    await supabase.from('story_item_posts')
      .upsert({ story_item_id: id, user_id: user.id, posted_date }, { onConflict: 'story_item_id,posted_date' })
  } else {
    await supabase.from('story_item_posts')
      .delete().eq('story_item_id', id).eq('posted_date', posted_date)
  }
  return NextResponse.json({ ok: true })
}
