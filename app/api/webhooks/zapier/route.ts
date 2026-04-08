import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { routeZapierWebhook } from '@/lib/zapier'
import type { ZapierPayload } from '@/lib/zapier'

// Use service role client — webhooks arrive without a session
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

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

  // user_id can come from URL query param (?uid=...) or from the request body (legacy)
  const uidFromUrl = new URL(request.url).searchParams.get('uid')
  const { user_id: user_id_body, type, data } = body
  const user_id = uidFromUrl ?? user_id_body

  if (!user_id || !type || !data) {
    return NextResponse.json({ error: 'Missing fields: user_id, type, data' }, { status: 400 })
  }

  // Verify user exists (service role bypasses RLS — safe since secret was already validated)
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
