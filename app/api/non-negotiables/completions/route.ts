import { createServerSupabaseClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const since = new Date(); since.setDate(since.getDate() - 90)
  const { data } = await supabase
    .from('non_negotiable_completions')
    .select('*')
    .eq('user_id', user.id)
    .gte('date', since.toISOString().slice(0, 10))
    .order('date', { ascending: false })
  return NextResponse.json({ completions: data ?? [] })
}
