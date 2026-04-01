import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

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
  const keyData = encoder.encode(signingKey)
  const msgData = encoder.encode(`${timestamp}.${rawBody}`)

  const cryptoKey = await crypto.subtle.importKey(
    'raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, msgData)
  const computed = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('')
  return computed === v1
}

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text()
    let body: { event?: string; payload?: Record<string, unknown> }
    try {
      body = JSON.parse(rawBody)
    } catch {
      return NextResponse.json({ ok: false, reason: 'invalid_json' }, { status: 400 })
    }

    const event = body.event
    const payload = body.payload as Record<string, unknown> | undefined

    // Only handle new bookings
    if (event !== 'invitee.created') {
      return NextResponse.json({ ok: true })
    }

    const p = payload as { invitee?: { name?: string; email?: string }; name?: string; email?: string; scheduled_event?: { start_time?: string; name?: string } } | undefined
    const inviteeName: string = p?.invitee?.name ?? p?.name ?? ''
    const inviteeEmail: string = p?.invitee?.email ?? p?.email ?? ''
    const startTime: string = p?.scheduled_event?.start_time ?? ''
    const eventName: string = p?.scheduled_event?.name ?? 'Call'

    // Find which user this Calendly account belongs to + get signing key
    const { data: integrations, error: integrationErr } = await supabase
      .from('calendly_integrations')
      .select('user_id, webhook_signing_key')
      .limit(1)
      .single()

    if (integrationErr) {
      console.error('[calendly] Failed to query calendly_integrations', integrationErr)
    }

    if (!integrations) {
      return NextResponse.json({ ok: false, reason: 'no_integration' }, { status: 404 })
    }

    // Verify signature if we have the signing key
    if (integrations.webhook_signing_key) {
      const sigHeader = request.headers.get('Calendly-Webhook-Signature')
      const valid = await verifyCalendlySignature(rawBody, sigHeader, integrations.webhook_signing_key)
      if (!valid) {
        console.warn('[calendly] Invalid webhook signature — rejecting')
        return NextResponse.json({ ok: false, reason: 'invalid_signature' }, { status: 401 })
      }
    }

    const userId = integrations.user_id

    // Try to find existing lead matching the invitee
    let leadId: string | null = null

    if (inviteeName) {
      const nameParts = inviteeName.toLowerCase().split(' ')
      const { data: existingLeads, error: leadsErr } = await supabase
        .from('leads')
        .select('id, ig_username, full_name')
        .eq('user_id', userId)
        .neq('stage', 'closed')

      if (leadsErr) {
        console.error('[calendly] Failed to query leads', leadsErr)
      }

      if (existingLeads) {
        const match = existingLeads.find(l =>
          nameParts.some(part =>
            l.full_name.toLowerCase().includes(part) ||
            l.ig_username.toLowerCase().includes(part)
          )
        )
        if (match) leadId = match.id
      }
    }

    if (leadId) {
      // Update existing lead to call_booked
      const { error: updateErr } = await supabase
        .from('leads')
        .update({
          stage: 'call_booked',
          call_booked_at: startTime || new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', leadId)

      if (updateErr) {
        console.error('[calendly] Failed to update lead to call_booked', updateErr)
        return NextResponse.json({ ok: false, reason: 'db_update_failed' }, { status: 500 })
      }

      const { error: historyErr } = await supabase.from('lead_history').insert({
        lead_id: leadId,
        action: `Call booked via Calendly — ${eventName}${startTime ? ` on ${new Date(startTime).toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}` : ''}`,
        actor: 'Calendly',
      })
      if (historyErr) {
        console.error('[calendly] Failed to insert lead_history after update', historyErr)
      }
    } else {
      // Create a new lead at call_booked stage
      const { data: newLead, error: insertErr } = await supabase
        .from('leads')
        .insert({
          user_id: userId,
          ig_username: inviteeEmail ? inviteeEmail.split('@')[0] : 'unknown',
          full_name: inviteeName || inviteeEmail || 'Unknown',
          phone: '',
          stage: 'call_booked',
          call_booked_at: startTime || new Date().toISOString(),
          source: 'calendly',
          last_contact_at: new Date().toISOString(),
        })
        .select()
        .single()

      if (insertErr) {
        console.error('[calendly] Failed to insert new lead', insertErr)
        return NextResponse.json({ ok: false, reason: 'db_insert_failed' }, { status: 500 })
      }

      if (newLead) {
        leadId = newLead.id
        const { error: historyErr } = await supabase.from('lead_history').insert({
          lead_id: newLead.id,
          action: `Booked call via Calendly — ${eventName}${startTime ? ` on ${new Date(startTime).toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}` : ''}`,
          actor: 'Calendly',
        })
        if (historyErr) {
          console.error('[calendly] Failed to insert lead_history after insert', historyErr)
        }
      }
    }

    // Create a task to log call outcome
    if (leadId && startTime) {
      const callDate = new Date(startTime)
      const taskDue = new Date(callDate.getTime() + 2 * 60 * 60 * 1000) // 2hr after call

      const { error: taskErr } = await supabase.from('tasks').insert({
        user_id: userId,
        type: 'call_outcome',
        priority: 'today',
        title: `Log outcome — ${inviteeName || 'Calendly booking'}`,
        description: `Call at ${callDate.toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' })}`,
        lead_id: leadId,
        due_at: taskDue.toISOString(),
        auto_generated: true,
      })
      if (taskErr) {
        console.error('[calendly] Failed to insert call outcome task', taskErr)
      }
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[calendly] Unexpected error in webhook handler', err)
    return NextResponse.json({ ok: false, reason: 'internal_error' }, { status: 500 })
  }
}
