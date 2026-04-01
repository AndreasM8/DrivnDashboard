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
  installment_id?: string
  amount: number
}

export type ZapierPayload =
  | { type: 'new_lead'; data: NewLeadPayload }
  | { type: 'lead_replied'; data: LeadRepliedPayload }
  | { type: 'freebie_sent'; data: FreebieSentPayload }
  | { type: 'lead_contact'; data: LeadContactPayload }
  | { type: 'stripe_payment_succeeded'; data: StripePaymentSucceededPayload }
  | { type: 'stripe_payment_failed'; data: StripePaymentFailedPayload }

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Stage ordering — only move forward, never backward
const STAGE_ORDER = ['follower', 'replied', 'freebie_sent', 'call_booked', 'closed']
function isForwardMove(current: string, next: string) {
  return STAGE_ORDER.indexOf(next) > STAGE_ORDER.indexOf(current)
}

// ─── Handlers ─────────────────────────────────────────────────────────────────

export async function handleNewLead(userId: string, data: NewLeadPayload) {
  const supabase = await createServerSupabaseClient()

  // Idempotent: if lead with this ig_username already exists, just touch last_contact_at
  const { data: existing } = await supabase
    .from('leads')
    .select('id, stage')
    .eq('user_id', userId)
    .ilike('ig_username', data.ig_username)
    .maybeSingle()

  if (existing) {
    // Already in pipeline — just update last contact, don't duplicate
    await supabase
      .from('leads')
      .update({ last_contact_at: new Date().toISOString() })
      .eq('id', existing.id)
    return
  }

  const { data: lead } = await supabase.from('leads').insert({
    user_id: userId,
    ig_username: data.ig_username,
    full_name: data.full_name ?? '',
    source_flow: data.source_flow ?? 'ManyChat / Zapier',
    stage: 'follower',
    last_contact_at: new Date().toISOString(),
  }).select().single()

  if (lead) {
    await supabase.from('lead_history').insert({
      lead_id: lead.id,
      action: 'Added to pipeline via ManyChat / Zapier',
      actor: 'Automation',
    })
  }
}

export async function handleLeadReplied(userId: string, data: LeadRepliedPayload) {
  const supabase = await createServerSupabaseClient()

  const { data: lead } = await supabase
    .from('leads')
    .select('id, stage')
    .eq('user_id', userId)
    .ilike('ig_username', data.ig_username)
    .maybeSingle()

  if (!lead) return  // Unknown lead — ignore

  // Only advance stage, never go backward
  if (!isForwardMove(lead.stage, 'replied')) return

  await supabase
    .from('leads')
    .update({ stage: 'replied', last_contact_at: new Date().toISOString() })
    .eq('id', lead.id)

  await supabase.from('lead_history').insert({
    lead_id: lead.id,
    action: 'Replied — stage moved to Replied',
    actor: 'Automation',
  })
}

export async function handleFreebieSent(userId: string, data: FreebieSentPayload) {
  const supabase = await createServerSupabaseClient()

  const { data: lead } = await supabase
    .from('leads')
    .select('id, stage')
    .eq('user_id', userId)
    .ilike('ig_username', data.ig_username)
    .maybeSingle()

  if (!lead) return

  if (!isForwardMove(lead.stage, 'freebie_sent')) return

  await supabase
    .from('leads')
    .update({
      stage: 'freebie_sent',
      freebie_sent_at: new Date().toISOString(),
      last_contact_at: new Date().toISOString(),
    })
    .eq('id', lead.id)

  // ── Auto-apply "Freebie sent" label ───────────────────────────────────────

  // Find or create the label for this user
  let labelId: string | null = null
  const { data: existingLabel } = await supabase
    .from('lead_labels')
    .select('id')
    .eq('user_id', userId)
    .ilike('name', 'Freebie sent')
    .maybeSingle()

  if (existingLabel) {
    labelId = existingLabel.id
  } else {
    const { data: newLabel } = await supabase
      .from('lead_labels')
      .insert({
        user_id: userId,
        name: 'Freebie sent',
        bg_color: '#DDD6FE',
        text_color: '#5B21B6',
      })
      .select()
      .single()
    if (newLabel) labelId = newLabel.id
  }

  // Assign label to lead (ignore conflict if already assigned)
  if (labelId) {
    const { data: existingAssignment } = await supabase
      .from('lead_label_assignments')
      .select('id')
      .eq('lead_id', lead.id)
      .eq('label_id', labelId)
      .maybeSingle()

    if (!existingAssignment) {
      await supabase
        .from('lead_label_assignments')
        .insert({ lead_id: lead.id, label_id: labelId })
    }
  }

  // ── History entry ──────────────────────────────────────────────────────────
  await supabase.from('lead_history').insert({
    lead_id: lead.id,
    action: 'Freebie sent via ManyChat — label applied automatically',
    actor: 'Automation',
  })
}

export async function handleLeadContact(userId: string, data: LeadContactPayload) {
  const supabase = await createServerSupabaseClient()
  await supabase
    .from('leads')
    .update({ last_contact_at: new Date().toISOString() })
    .eq('user_id', userId)
    .ilike('ig_username', data.ig_username)
}

export async function handleStripePaymentSucceeded(
  userId: string,
  data: StripePaymentSucceededPayload
) {
  const supabase = await createServerSupabaseClient()

  if (data.installment_id) {
    const { error } = await supabase
      .from('payment_installments')
      .update({
        paid: true,
        paid_at: new Date().toISOString(),
        stripe_payment_id: data.stripe_payment_id,
      })
      .eq('id', data.installment_id)
    if (error) console.error('Zapier: failed to mark installment paid', error.message)
    return
  }

  // No installment_id — try to match by client_id
  if (data.client_id) {
    const { data: unpaid } = await supabase
      .from('payment_installments')
      .select('id')
      .eq('client_id', data.client_id)
      .eq('paid', false)
      .order('due_date')
      .limit(1)
      .maybeSingle()

    if (unpaid) {
      await supabase.from('payment_installments').update({
        paid: true,
        paid_at: new Date().toISOString(),
        stripe_payment_id: data.stripe_payment_id,
      }).eq('id', unpaid.id)
      return
    }
  }

  // No match — create a manual-review task
  await supabase.from('tasks').insert({
    user_id: userId,
    type: 'payment',
    priority: 'today',
    title: 'Unmatched Stripe payment — check manually',
    description: `A Stripe payment of ${data.amount} arrived but couldn't be matched to an installment. Stripe ID: ${data.stripe_payment_id}`,
    due_at: new Date().toISOString(),
    auto_generated: true,
  })
}

export async function handleStripePaymentFailed(
  userId: string,
  data: StripePaymentFailedPayload
) {
  const supabase = await createServerSupabaseClient()

  // Try to look up client from installment if client_id not provided
  let clientId = data.client_id
  if (!clientId && data.installment_id) {
    const { data: inst } = await supabase
      .from('payment_installments')
      .select('client_id')
      .eq('id', data.installment_id)
      .maybeSingle()
    if (inst) clientId = inst.client_id
  }

  await supabase.from('tasks').insert({
    user_id: userId,
    type: 'payment',
    priority: 'today',
    title: 'Payment failed — chase client',
    description: `Stripe reported a failed payment${data.amount ? ` of ${data.amount}` : ''}. Chase the client or check Stripe.`,
    client_id: clientId ?? null,
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
      throw new Error(`Unknown webhook type: ${(payload as { type: string }).type}`)
  }

  // Fire-and-forget sheets sync — never blocks the webhook response
  syncToSheets(userId).catch((err) => {
    console.error('Zapier: sheets sync failed silently:', err?.message)
  })
}
