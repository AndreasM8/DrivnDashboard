import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export async function GET() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data } = await supabase
    .from('users')
    .select('stripe_connected, stripe_webhook_secret')
    .eq('id', user.id)
    .single()

  return NextResponse.json({
    connected: data?.stripe_connected ?? false,
    has_secret: !!(data?.stripe_webhook_secret),
  })
}

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { secret } = await req.json()

  await supabase
    .from('users')
    .update({
      stripe_webhook_secret: secret || null,
      stripe_connected: !!secret,
    })
    .eq('id', user.id)

  return NextResponse.json({ ok: true })
}

export async function DELETE() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await supabase
    .from('users')
    .update({ stripe_webhook_secret: null, stripe_connected: false })
    .eq('id', user.id)

  return NextResponse.json({ ok: true })
}
