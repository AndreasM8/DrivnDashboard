import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const { completed, date } = await req.json() as { completed: boolean; date: string }
  const today = date ?? new Date().toISOString().slice(0, 10)

  const { data, error } = await supabase
    .from('non_negotiable_completions')
    .upsert(
      {
        user_id: user.id,
        non_negotiable_id: id,
        date: today,
        completed,
        completed_at: completed ? new Date().toISOString() : null,
      },
      { onConflict: 'user_id,non_negotiable_id,date' }
    )
    .select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ completion: data })
}
