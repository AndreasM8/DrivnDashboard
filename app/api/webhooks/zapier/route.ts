import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { routeZapierWebhook } from '@/lib/zapier'
import type { ZapierPayload } from '@/lib/zapier'

export async function POST(request: NextRequest) {
  // Validate secret
  const secret = request.headers.get('x-zapier-secret')
  if (secret !== process.env.ZAPIER_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { user_id?: string; type?: string; data?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { user_id, type, data } = body

  if (!user_id || !type || !data) {
    return NextResponse.json({ error: 'Missing fields: user_id, type, data' }, { status: 400 })
  }

  // Verify user exists
  const supabase = await createServerSupabaseClient()
  const { data: user } = await supabase.from('users').select('id').eq('id', user_id).single()
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  try {
    await routeZapierWebhook(user_id, { type, data } as ZapierPayload)
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Zapier webhook error:', err)
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
  }
}
