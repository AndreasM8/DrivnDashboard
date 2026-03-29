import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export async function GET() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ connected: false })

  const { data } = await supabase
    .from('calendly_integrations')
    .select('connected_at, user_uri')
    .eq('user_id', user.id)
    .single()

  return NextResponse.json({
    connected: !!data,
    connectedAt: data?.connected_at ?? null,
    userUri: data?.user_uri ?? null,
  })
}

export async function DELETE() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await supabase
    .from('calendly_integrations')
    .delete()
    .eq('user_id', user.id)

  return NextResponse.json({ ok: true })
}
