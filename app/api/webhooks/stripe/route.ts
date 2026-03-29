import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

// Stripe sends webhooks with a signature we verify using the webhook secret.
// Set STRIPE_WEBHOOK_SECRET in .env.local (from Stripe Dashboard → Webhooks).

async function verifyStripeSignature(body: string, signature: string, secret: string): Promise<boolean> {
  // Stripe signature format: t=timestamp,v1=hash
  const parts = Object.fromEntries(signature.split(',').map(p => p.split('=')))
  const timestamp = parts['t']
  const v1 = parts['v1']
  if (!timestamp || !v1) return false

  const payload = `${timestamp}.${body}`
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload))
  const computed = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('')
  return computed === v1
}

export async function POST(request: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 })
  }

  const body = await request.text()
  const signature = request.headers.get('stripe-signature') ?? ''

  const valid = await verifyStripeSignature(body, signature, secret)
  if (!valid) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  let event: { type: string; data: { object: Record<string, unknown> } }
  try {
    event = JSON.parse(body)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const supabase = await createServerSupabaseClient()

  if (event.type === 'payment_intent.succeeded') {
    const pi = event.data.object
    const clientId = pi['metadata'] && typeof pi['metadata'] === 'object'
      ? (pi['metadata'] as Record<string, string>)['client_id']
      : undefined
    const installmentId = pi['metadata'] && typeof pi['metadata'] === 'object'
      ? (pi['metadata'] as Record<string, string>)['installment_id']
      : undefined

    if (installmentId) {
      await supabase
        .from('payment_installments')
        .update({
          paid: true,
          paid_at: new Date().toISOString(),
          stripe_payment_id: pi['id'] as string,
        })
        .eq('id', installmentId)
    } else if (clientId) {
      // PIF — mark client as fully paid
      await supabase
        .from('payment_installments')
        .update({ paid: true, paid_at: new Date().toISOString() })
        .eq('client_id', clientId)
    }
  }

  if (event.type === 'payment_intent.payment_failed') {
    const pi = event.data.object
    const meta = pi['metadata'] && typeof pi['metadata'] === 'object'
      ? pi['metadata'] as Record<string, string>
      : {}
    const clientId = meta['client_id']
    const installmentId = meta['installment_id']
    const userId = meta['user_id']

    if (clientId && userId) {
      await supabase.from('tasks').insert({
        user_id: userId,
        type: 'payment',
        priority: 'today',
        title: 'Payment failed',
        description: `Stripe reported a failed payment. Check Stripe or follow up with the client.`,
        client_id: clientId,
        due_at: new Date().toISOString(),
        auto_generated: true,
        completed: false,
      })

      if (installmentId) {
        await supabase
          .from('payment_installments')
          .update({ paid: false })
          .eq('id', installmentId)
      }
    }
  }

  return NextResponse.json({ received: true })
}
