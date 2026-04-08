import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import type { WeeklyCheckin, CheckinPrefill } from '@/types'

function getWeekBounds(date: Date = new Date()): { weekStart: string; weekEnd: string } {
  const d = new Date(date)
  const day = d.getUTCDay() // 0=Sun
  const diff = day === 0 ? -6 : 1 - day
  const monday = new Date(d)
  monday.setUTCDate(d.getUTCDate() + diff)
  const sunday = new Date(monday)
  sunday.setUTCDate(monday.getUTCDate() + 6)
  return {
    weekStart: monday.toISOString().slice(0, 10),
    weekEnd: sunday.toISOString().slice(0, 10),
  }
}

export async function GET() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { weekStart, weekEnd } = getWeekBounds()
  const now = new Date()

  // Check for existing check-in this week
  const { data: checkin } = await supabase
    .from('weekly_checkins')
    .select('*')
    .eq('user_id', user.id)
    .eq('week_start', weekStart)
    .single()

  const existingCheckin = checkin as WeeklyCheckin | null

  if (existingCheckin?.submitted_at) {
    return NextResponse.json({ status: 'submitted', checkin: existingCheckin })
  }

  if (
    existingCheckin?.snoozed_until &&
    new Date(existingCheckin.snoozed_until) > now
  ) {
    return NextResponse.json({ status: 'snoozed', checkin: existingCheckin })
  }

  // Compute prefill data
  const [
    { data: newLeads },
    { data: repliedLeads },
    { data: bookedLeads },
    { data: closedClients },
    { data: paidInstallments },
    { data: newClients },
  ] = await Promise.all([
    supabase.from('leads').select('id').eq('user_id', user.id).gte('created_at', weekStart),
    supabase.from('leads').select('id').eq('user_id', user.id)
      .in('stage', ['replied', 'freebie_sent', 'call_booked', 'second_call', 'closed'])
      .gte('updated_at', weekStart),
    supabase.from('leads').select('id').eq('user_id', user.id)
      .in('stage', ['call_booked', 'second_call', 'closed'])
      .gte('updated_at', weekStart),
    supabase.from('clients').select('id').eq('user_id', user.id).gte('started_at', weekStart),
    supabase.from('payment_installments')
      .select('amount, clients!inner(user_id)')
      .eq('clients.user_id', user.id)
      .eq('paid', true)
      .gte('paid_at', weekStart),
    supabase.from('clients')
      .select('payment_type, total_amount, monthly_amount, plan_months')
      .eq('user_id', user.id)
      .gte('started_at', weekStart),
  ])

  const cashCollected = (paidInstallments ?? []).reduce((s, i) => {
    const row = i as unknown as { amount: number }
    return s + row.amount
  }, 0)

  // Add PIF/split amounts for new clients this week
  const weekClients = (newClients ?? []) as Array<{
    payment_type: string
    total_amount: number
    monthly_amount: number | null
    plan_months: number | null
  }>
  const cashFromNew = weekClients
    .filter(c => c.payment_type !== 'plan')
    .reduce((s, c) => s + c.total_amount, 0)

  const revenueContracted = weekClients.reduce((s, c) => {
    if (c.payment_type === 'plan' && c.monthly_amount && c.plan_months) {
      return s + c.monthly_amount * c.plan_months
    }
    return s + c.total_amount
  }, 0)

  const prefill: CheckinPrefill = {
    followersGained: (newLeads ?? []).length,
    repliesReceived: (repliedLeads ?? []).length,
    callsBooked: (bookedLeads ?? []).length,
    clientsClosed: (closedClients ?? []).length,
    cashCollected: cashCollected + cashFromNew,
    revenueContracted,
  }

  const status = existingCheckin ? 'pending' : 'due'

  return NextResponse.json({ status, checkin: existingCheckin, prefill, weekStart, weekEnd })
}
