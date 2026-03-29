import { createServerSupabaseClient } from './supabase-server'
import { syncToSheets } from './google-sheets'

// ─── Webhook payload types ────────────────────────────────────────────────────

interface NewLeadPayload {
  ig_username: string
  full_name?: string
  source_flow?: string
}

interface LeadRepliedPayload {
  ig_username: string
}

interface FreebieSentPayload {
  ig_username: string
}

interface LeadContactPayload {
  ig_username: string
}

interface StripePaymentSucceededPayload {
  stripe_payment_id: string
  client_id?: string
  installment_id?: string
  amount: number
}

interface StripePaymentFailedPayload {
  client_id: string
  installment_id: string
  amount: number
}

export type ZapierPayload =
  | { type: 'new_lead'; data: NewLeadPayload }
  | { type: 'lead_replied'; data: LeadRepliedPayload }
  | { type: 'freebie_sent'; data: FreebieSentPayload }
  | { type: 'lead_contact'; data: LeadContactPayload }
  | { type: 'stripe_payment_succeeded'; data: StripePaymentSucceededPayload }
  | { type: 'stripe_payment_failed'; data: StripePaymentFailedPayload }

// ─── Handlers ─────────────────────────────────────────────────────────────────

export async function handleNewLead(userId: string, data: NewLeadPayload) {
  const supabase = await createServerSupabaseClient()
  await supabase.from('leads').insert({
    user_id: userId,
    ig_username: data.ig_username,
    full_name: data.full_name ?? '',
    source_flow: data.source_flow ?? '',
    stage: 'follower',
    last_contact_at: new Date().toISOString(),
  })
}

export async function handleLeadReplied(userId: string, data: LeadRepliedPayload) {
  const supabase = await createServerSupabaseClient()
  await supabase
    .from('leads')
    .update({ stage: 'replied', last_contact_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('ig_username', data.ig_username)
}

export async function handleFreebieSent(userId: string, data: FreebieSentPayload) {
  const supabase = await createServerSupabaseClient()
  await supabase
    .from('leads')
    .update({
      stage: 'freebie_sent',
      freebie_sent_at: new Date().toISOString(),
      last_contact_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .eq('ig_username', data.ig_username)
}

export async function handleLeadContact(userId: string, data: LeadContactPayload) {
  const supabase = await createServerSupabaseClient()
  await supabase
    .from('leads')
    .update({ last_contact_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('ig_username', data.ig_username)
}

export async function handleStripePaymentSucceeded(
  _userId: string,
  data: StripePaymentSucceededPayload
) {
  const supabase = await createServerSupabaseClient()
  if (data.installment_id) {
    await supabase
      .from('payment_installments')
      .update({
        paid: true,
        paid_at: new Date().toISOString(),
        stripe_payment_id: data.stripe_payment_id,
      })
      .eq('id', data.installment_id)
  }
}

export async function handleStripePaymentFailed(
  userId: string,
  data: StripePaymentFailedPayload
) {
  const supabase = await createServerSupabaseClient()
  await supabase.from('tasks').insert({
    user_id: userId,
    type: 'payment',
    priority: 'today',
    title: 'Payment not received',
    description: 'Stripe reported a failed payment. Chase the client or check Stripe.',
    client_id: data.client_id,
    due_at: new Date().toISOString(),
    auto_generated: true,
  })
}

// ─── Router ───────────────────────────────────────────────────────────────────

export async function routeZapierWebhook(userId: string, payload: ZapierPayload) {
  switch (payload.type) {
    case 'new_lead':
      await handleNewLead(userId, payload.data)
      break
    case 'lead_replied':
      await handleLeadReplied(userId, payload.data)
      break
    case 'freebie_sent':
      await handleFreebieSent(userId, payload.data)
      break
    case 'lead_contact':
      await handleLeadContact(userId, payload.data)
      break
    case 'stripe_payment_succeeded':
      await handleStripePaymentSucceeded(userId, payload.data)
      break
    case 'stripe_payment_failed':
      await handleStripePaymentFailed(userId, payload.data)
      break
    default:
      throw new Error(`Unknown webhook type`)
  }

  // Fire-and-forget sync — don't block the webhook response
  syncToSheets(userId).catch(() => {})
}
