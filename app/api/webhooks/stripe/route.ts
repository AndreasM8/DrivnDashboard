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
  try {
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
      const meta = pi['metadata'] && typeof pi['metadata'] === 'object'
        ? pi['metadata'] as Record<string, string>
        : {}
      const clientId = meta['client_id']
      const installmentId = meta['installment_id']
      const userId = meta['user_id']

      if (installmentId) {
        const { error: updateErr } = await supabase
          .from('payment_installments')
          .update({
            paid: true,
            paid_at: new Date().toISOString(),
            stripe_payment_id: pi['id'] as string,
          })
          .eq('id', installmentId)
        if (updateErr) {
          console.error('[stripe] payment_intent.succeeded: failed to update installment', updateErr)
        }
      } else if (clientId) {
        // PIF — mark client as fully paid
        const { error: updateErr } = await supabase
          .from('payment_installments')
          .update({ paid: true, paid_at: new Date().toISOString() })
          .eq('client_id', clientId)
        if (updateErr) {
          console.error('[stripe] payment_intent.succeeded: failed to update installments for client', updateErr)
        }
      } else {
        // No matching IDs — create a manual-review task so nothing slips through
        const piId = (pi['id'] as string) ?? 'unknown'
        const amountCents = typeof pi['amount'] === 'number' ? pi['amount'] : null
        const amountDisplay = amountCents !== null
          ? `$${(amountCents / 100).toFixed(2)}`
          : 'unknown amount'
        const currency = typeof pi['currency'] === 'string' ? (pi['currency'] as string).toUpperCase() : ''

        // We need a user_id to attach the task — try to find any active user as fallback
        const taskUserId = userId ?? null
        if (taskUserId) {
          const { error: taskErr } = await supabase.from('tasks').insert({
            user_id: taskUserId,
            type: 'payment',
            priority: 'today',
            title: 'Unmatched Stripe payment — check manually',
            description: `Stripe reported a successful payment (ID: ${piId}, amount: ${amountDisplay}${currency ? ' ' + currency : ''}) but it could not be matched to any client or installment. Please reconcile in Stripe.`,
            due_at: new Date().toISOString(),
            auto_generated: true,
            completed: false,
          })
          if (taskErr) {
            console.error('[stripe] payment_intent.succeeded: failed to insert unmatched payment task', taskErr)
          }
        } else {
          console.warn('[stripe] payment_intent.succeeded: unmatched payment with no user_id in metadata — cannot create task. PI:', piId, 'amount:', amountDisplay)
        }
      }
    }

    if (event.type === 'payment_intent.payment_failed') {
      const pi = event.data.object
      const meta = pi['metadata'] && typeof pi['metadata'] === 'object'
        ? pi['metadata'] as Record<string, string>
        : {}
      let clientId = meta['client_id']
      const installmentId = meta['installment_id']
      let userId = meta['user_id']

      // If we have an installmentId but are missing clientId or userId, look them up
      if (installmentId && (!clientId || !userId)) {
        const { data: installment, error: installErr } = await supabase
          .from('payment_installments')
          .select('client_id, clients(user_id)')
          .eq('id', installmentId)
          .single()
        if (installErr) {
          console.error('[stripe] payment_intent.payment_failed: failed to look up installment', installErr)
        } else if (installment) {
          if (!clientId) clientId = (installment as Record<string, unknown>)['client_id'] as string
          if (!userId) {
            const clients = (installment as Record<string, unknown>)['clients']
            if (clients && typeof clients === 'object' && !Array.isArray(clients)) {
              userId = (clients as Record<string, string>)['user_id']
            }
          }
        }
      }

      if (clientId && userId) {
        const { error: taskErr } = await supabase.from('tasks').insert({
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
        if (taskErr) {
          console.error('[stripe] payment_intent.payment_failed: failed to insert task', taskErr)
        }

        if (installmentId) {
          const { error: updateErr } = await supabase
            .from('payment_installments')
            .update({ paid: false })
            .eq('id', installmentId)
          if (updateErr) {
            console.error('[stripe] payment_intent.payment_failed: failed to update installment', updateErr)
          }
        }
      } else {
        console.warn('[stripe] payment_intent.payment_failed: could not resolve clientId or userId — task not created. meta:', meta)
      }
    }

    return NextResponse.json({ received: true })
  } catch (err) {
    console.error('[stripe] Unexpected error in webhook handler', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
