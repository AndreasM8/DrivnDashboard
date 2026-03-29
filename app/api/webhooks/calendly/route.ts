import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  const body = await request.json()

  const event = body.event
  const payload = body.payload

  // Only handle new bookings
  if (event !== 'invitee.created') {
    return NextResponse.json({ ok: true })
  }

  const inviteeName: string = payload?.name ?? ''
  const inviteeEmail: string = payload?.email ?? ''
  const startTime: string = payload?.scheduled_event?.start_time ?? ''
  const eventName: string = payload?.scheduled_event?.name ?? 'Call'

  // Find which user this Calendly account belongs to
  const organizationUri: string = payload?.scheduled_event?.event_type_uuid ?? ''
  const scheduledEventUri: string = payload?.scheduled_event?.uri ?? ''

  // Try to find existing lead by name or email
  // We'll use the first user's data for now (single-tenant per Calendly token)
  // In multi-tenant: match via organization_uri in calendly_integrations
  const { data: integrations } = await supabase
    .from('calendly_integrations')
    .select('user_id')
    .limit(1)
    .single()

  if (!integrations) {
    return NextResponse.json({ ok: true })
  }

  const userId = integrations.user_id

  // Try to find existing lead matching the invitee
  let leadId: string | null = null

  if (inviteeName) {
    const nameParts = inviteeName.toLowerCase().split(' ')
    const { data: existingLeads } = await supabase
      .from('leads')
      .select('id, ig_username, full_name')
      .eq('user_id', userId)
      .neq('stage', 'closed')

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
    await supabase
      .from('leads')
      .update({
        stage: 'call_booked',
        call_booked_at: startTime || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', leadId)

    await supabase.from('lead_history').insert({
      lead_id: leadId,
      action: `Call booked via Calendly — ${eventName}${startTime ? ` on ${new Date(startTime).toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}` : ''}`,
      actor: 'Calendly',
    })
  } else {
    // Create a new lead at call_booked stage
    const { data: newLead } = await supabase
      .from('leads')
      .insert({
        user_id: userId,
        ig_username: inviteeEmail.split('@')[0] || 'unknown',
        full_name: inviteeName || inviteeEmail,
        phone: '',
        stage: 'call_booked',
        call_booked_at: startTime || new Date().toISOString(),
        source: 'calendly',
        last_contact_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (newLead) {
      leadId = newLead.id
      await supabase.from('lead_history').insert({
        lead_id: newLead.id,
        action: `Booked call via Calendly — ${eventName}${startTime ? ` on ${new Date(startTime).toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}` : ''}`,
        actor: 'Calendly',
      })
    }
  }

  // Create a task to log call outcome
  if (leadId && startTime) {
    const callDate = new Date(startTime)
    const taskDue = new Date(callDate.getTime() + 2 * 60 * 60 * 1000) // 2hr after call

    await supabase.from('tasks').insert({
      user_id: userId,
      type: 'call_outcome',
      priority: 'today',
      title: `Log outcome — ${inviteeName || 'Calendly booking'}`,
      description: `Call at ${callDate.toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' })}`,
      lead_id: leadId,
      due_at: taskDue.toISOString(),
      auto_generated: true,
    })
  }

  return NextResponse.json({ ok: true })
}
