import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ─── Signature verification ───────────────────────────────────────────────────

async function verifyCalendlySignature(
  rawBody: string,
  signatureHeader: string | null,
  signingKey: string,
): Promise<boolean> {
  if (!signatureHeader) return false
  // Format: t=<timestamp>,v1=<hmac>
  const parts = Object.fromEntries(signatureHeader.split(',').map(p => p.split('=')))
  const timestamp = parts['t']
  const v1 = parts['v1']
  if (!timestamp || !v1) return false

  const encoder = new TextEncoder()
  const cryptoKey = await crypto.subtle.importKey(
    'raw', encoder.encode(signingKey), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(`${timestamp}.${rawBody}`))
  const computed = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('')
  return computed === v1
}

// ─── Payload types ────────────────────────────────────────────────────────────

interface CalendlyPayload {
  invitee?: { name?: string; email?: string }
  name?: string
  email?: string
  scheduled_event?: {
    start_time?: string
    name?: string
    // event_memberships tells us which Calendly user owns this booking
    event_memberships?: { user?: string }[]
  }
  cancellation?: {
    canceled_by?: string
    reason?: string
  }
}

function formatCallTime(iso: string) {
  return new Date(iso).toLocaleDateString('en', {
    weekday: 'short', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

// ─── Lead matching ────────────────────────────────────────────────────────────

async function findLeadId(userId: string, name: string, email: string): Promise<string | null> {
  if (!name && !email) return null

  const { data: leads } = await supabase
    .from('leads')
    .select('id, ig_username, full_name')
    .eq('user_id', userId)
    .neq('stage', 'closed')

  if (!leads?.length) return null

  const nameParts = name.toLowerCase().split(' ').filter(Boolean)
  const emailUser = email ? email.split('@')[0].toLowerCase() : ''

  const match = leads.find(l => {
    const fn = l.full_name.toLowerCase()
    const ig = l.ig_username.toLowerCase()
    return (
      nameParts.some(p => fn.includes(p) || ig.includes(p)) ||
      (emailUser && (fn.includes(emailUser) || ig.includes(emailUser)))
    )
  })

  return match?.id ?? null
}

// ─── Handler: invitee.created ─────────────────────────────────────────────────

async function handleInviteeCreated(userId: string, p: CalendlyPayload) {
  const inviteeName = p?.invitee?.name ?? p?.name ?? ''
  const inviteeEmail = p?.invitee?.email ?? p?.email ?? ''
  const startTime = p?.scheduled_event?.start_time ?? ''
  const eventName = p?.scheduled_event?.name ?? 'Call'

  let leadId = await findLeadId(userId, inviteeName, inviteeEmail)

  if (leadId) {
    await supabase.from('leads').update({
      stage: 'call_booked',
      call_booked_at: startTime || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', leadId)

    await supabase.from('lead_history').insert({
      lead_id: leadId,
      action: `Call booked via Calendly — ${eventName}${startTime ? ` on ${formatCallTime(startTime)}` : ''}`,
      actor: 'Calendly',
    })
  } else {
    // No match — create a new lead directly at call_booked
    const { data: newLead } = await supabase.from('leads').insert({
      user_id: userId,
      ig_username: inviteeEmail ? inviteeEmail.split('@')[0] : 'unknown',
      full_name: inviteeName || inviteeEmail || 'Unknown',
      phone: '',
      stage: 'call_booked',
      call_booked_at: startTime || new Date().toISOString(),
      source: 'calendly',
      last_contact_at: new Date().toISOString(),
    }).select().single()

    if (newLead) {
      leadId = newLead.id
      await supabase.from('lead_history').insert({
        lead_id: newLead.id,
        action: `Booked call via Calendly — ${eventName}${startTime ? ` on ${formatCallTime(startTime)}` : ''}`,
        actor: 'Calendly',
      })
    }
  }

  // Create a "log outcome" task due 2 hours after the call
  if (leadId && startTime) {
    const callDate = new Date(startTime)
    await supabase.from('tasks').insert({
      user_id: userId,
      type: 'call_outcome',
      priority: 'today',
      title: `Log outcome — ${inviteeName || 'Calendly booking'}`,
      description: `Call at ${callDate.toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' })}`,
      lead_id: leadId,
      due_at: new Date(callDate.getTime() + 2 * 60 * 60 * 1000).toISOString(),
      auto_generated: true,
    })
  }
}

// ─── Handler: invitee.canceled ────────────────────────────────────────────────

async function handleInviteeCanceled(userId: string, p: CalendlyPayload) {
  const inviteeName = p?.invitee?.name ?? p?.name ?? ''
  const inviteeEmail = p?.invitee?.email ?? p?.email ?? ''
  const startTime = p?.scheduled_event?.start_time ?? ''
  const eventName = p?.scheduled_event?.name ?? 'Call'
  const canceledBy = p?.cancellation?.canceled_by ?? 'unknown'
  const reason = p?.cancellation?.reason ?? ''

  const leadId = await findLeadId(userId, inviteeName, inviteeEmail)
  if (!leadId) return // Can't do anything without a matched lead

  // Move lead back to nurture so they stay in the pipeline but out of call_booked
  await supabase.from('leads').update({
    stage: 'nurture',
    updated_at: new Date().toISOString(),
  }).eq('id', leadId).eq('stage', 'call_booked') // only move back if still at call_booked

  const reasonNote = reason ? ` — "${reason}"` : ''
  await supabase.from('lead_history').insert({
    lead_id: leadId,
    action: `Call canceled via Calendly — ${eventName}${startTime ? ` (was ${formatCallTime(startTime)})` : ''}, canceled by ${canceledBy}${reasonNote}`,
    actor: 'Calendly',
  })

  // Create a follow-up task
  await supabase.from('tasks').insert({
    user_id: userId,
    type: 'follow_up',
    priority: 'today',
    title: `Reschedule — ${inviteeName || 'Calendly booking'} canceled`,
    description: `Their ${eventName} was canceled by ${canceledBy}${reasonNote}. Reach out to reschedule.`,
    lead_id: leadId,
    due_at: new Date().toISOString(),
    auto_generated: true,
  })
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text()
    let body: { event?: string; payload?: CalendlyPayload }
    try {
      body = JSON.parse(rawBody)
    } catch {
      return NextResponse.json({ ok: false, reason: 'invalid_json' }, { status: 400 })
    }

    const event = body.event
    const payload = body.payload

    if (event !== 'invitee.created' && event !== 'invitee.canceled') {
      return NextResponse.json({ ok: true }) // ignore other events
    }

    // ── Identify which DrivnDashboard user owns this booking ──────────────────
    // Calendly includes the user URI in event_memberships — match it to our DB
    const calendlyUserUri =
      payload?.scheduled_event?.event_memberships?.[0]?.user ?? null

    let integration: { user_id: string; webhook_signing_key: string | null } | null = null

    if (calendlyUserUri) {
      const { data } = await supabase
        .from('calendly_integrations')
        .select('user_id, webhook_signing_key')
        .eq('user_uri', calendlyUserUri)
        .maybeSingle()
      integration = data
    }

    // Fallback: if no user_uri in payload (older Calendly plans), take the only row
    if (!integration) {
      const { data } = await supabase
        .from('calendly_integrations')
        .select('user_id, webhook_signing_key')
        .limit(1)
        .maybeSingle()
      integration = data
    }

    if (!integration) {
      console.warn('[calendly] No matching integration found for user_uri:', calendlyUserUri)
      return NextResponse.json({ ok: false, reason: 'no_integration' }, { status: 404 })
    }

    // ── Signature verification ────────────────────────────────────────────────
    if (integration.webhook_signing_key) {
      const sigHeader = request.headers.get('Calendly-Webhook-Signature')
      const valid = await verifyCalendlySignature(rawBody, sigHeader, integration.webhook_signing_key)
      if (!valid) {
        console.warn('[calendly] Invalid webhook signature — rejecting')
        return NextResponse.json({ ok: false, reason: 'invalid_signature' }, { status: 401 })
      }
    }

    // ── Dispatch ──────────────────────────────────────────────────────────────
    const userId = integration.user_id
    if (event === 'invitee.created') {
      await handleInviteeCreated(userId, payload ?? {})
    } else {
      await handleInviteeCanceled(userId, payload ?? {})
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[calendly] Unexpected error in webhook handler', err)
    return NextResponse.json({ ok: false, reason: 'internal_error' }, { status: 500 })
  }
}
