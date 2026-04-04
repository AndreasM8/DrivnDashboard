import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export async function PATCH(req: Request) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { hour } = await req.json() as { hour: number }
  if (hour < 0 || hour > 23) return NextResponse.json({ error: 'Invalid hour' }, { status: 400 })
  const { error } = await supabase.from('users').update({ nonneg_reset_hour: hour }).eq('id', user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
