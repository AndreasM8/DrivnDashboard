import { createServerSupabaseClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import NumbersClient from './NumbersClient'
import type { KpiTargets, MonthlySnapshot, Client, PaymentInstallment } from '@/types'

export default async function NumbersPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const now = new Date()
  const currentMonth = now.toISOString().slice(0, 7)
  const monthStart = `${currentMonth}-01`
  const lastMonth = new Date(new Date().setMonth(now.getMonth() - 1)).toISOString().slice(0, 7)

  const [
    { data: profile },
    { data: targets },
    { data: snapshots },
    { data: clients },
    { data: installments },
    { data: newLeads },
    { data: bookedLeads },
    { data: allMonthInstallments },
  ] = await Promise.all([
    supabase.from('users').select('base_currency, name').eq('id', user.id).single(),
    supabase.from('kpi_targets').select('*').eq('user_id', user.id).single(),
    supabase.from('monthly_snapshots').select('*').eq('user_id', user.id).order('month', { ascending: false }).limit(7),
    supabase.from('clients').select('*').eq('user_id', user.id).eq('active', true),
    // Join through clients so RLS + explicit user filter both apply
    supabase.from('payment_installments').select('*, clients!inner(user_id)').eq('clients.user_id', user.id),
    // All leads created this month = new followers
    supabase.from('leads').select('id').eq('user_id', user.id).gte('created_at', monthStart),
    // All leads with a call booked OR outcome this month (regardless of when lead was created)
    supabase.from('leads').select('call_booked_at, call_outcome').eq('user_id', user.id)
      .or(`call_booked_at.gte.${monthStart},and(call_outcome.not.is.null,updated_at.gte.${monthStart})`),
    // Installments paid this month — joined through clients for explicit user scoping
    supabase.from('payment_installments').select('amount, paid_at, clients!inner(user_id)')
      .eq('clients.user_id', user.id).eq('paid', true).gte('paid_at', monthStart),
  ])

  // ── Build live current-month snapshot from real data ──────────────────────
  const monthClients = (clients ?? []).filter(c =>
    (c as Client).started_at >= monthStart
  ) as Client[]

  const revenueContracted = monthClients.reduce((s, c) => s + c.total_amount, 0)

  // Cash collected = PIF/split clients started this month + installments paid this month
  const cashFromNewClients = monthClients
    .filter(c => c.payment_type !== 'plan')
    .reduce((s, c) => s + c.total_amount, 0)
  const cashFromInstallments = (allMonthInstallments ?? []).reduce((s, i) => s + (i as { amount: number }).amount, 0)
  const cashCollected = cashFromNewClients + cashFromInstallments

  // Leads metrics — correct scoping
  const newFollowers = (newLeads ?? []).length  // all leads created this month
  const allBookedLeads = bookedLeads ?? []
  const meetingsBooked = allBookedLeads.filter((l: { call_booked_at: string | null }) => l.call_booked_at && l.call_booked_at >= monthStart).length
  const outcomes = allBookedLeads.filter((l: { call_outcome: string | null }) => l.call_outcome)
  const showed = outcomes.filter((l: { call_outcome: string }) => l.call_outcome === 'showed').length
  const noShow = outcomes.filter((l: { call_outcome: string }) => l.call_outcome === 'no_show').length
  const canceled = outcomes.filter((l: { call_outcome: string }) => l.call_outcome === 'canceled').length
  const totalOutcomes = outcomes.length
  const clientsSigned = monthClients.length

  const showUpRate = totalOutcomes > 0 ? (showed / totalOutcomes) * 100 : 0
  const noShowRate = totalOutcomes > 0 ? (noShow / totalOutcomes) * 100 : 0
  const cancellationRate = totalOutcomes > 0 ? (canceled / totalOutcomes) * 100 : 0
  const closeRate = meetingsBooked > 0 ? (clientsSigned / meetingsBooked) * 100 : 0

  const liveSnapshot: MonthlySnapshot = {
    id: 'live',
    user_id: user.id,
    month: currentMonth,
    cash_collected: cashCollected,
    revenue_contracted: revenueContracted,
    new_followers: newFollowers,
    meetings_booked: meetingsBooked,
    calls_held: showed,
    clients_signed: clientsSigned,
    close_rate: closeRate,
    show_up_rate: showUpRate,
    no_show_rate: noShowRate,
    cancellation_rate: cancellationRate,
    created_at: now.toISOString(),
  }
  // ─────────────────────────────────────────────────────────────────────────

  const storedCurrentSnapshot = snapshots?.find(s => s.month === currentMonth)
  const lastMonthSnapshot = snapshots?.find(s => s.month === lastMonth)

  return (
    <NumbersClient
      baseCurrency={profile?.base_currency ?? 'NOK'}
      targets={(targets as KpiTargets) ?? null}
      currentSnapshot={storedCurrentSnapshot ? (storedCurrentSnapshot as MonthlySnapshot) : liveSnapshot}
      lastMonthSnapshot={(lastMonthSnapshot as MonthlySnapshot) ?? null}
      history={(snapshots as MonthlySnapshot[]) ?? []}
      clients={(clients as Client[]) ?? []}
      installments={(installments as PaymentInstallment[]) ?? []}
      currentMonth={currentMonth}
    />
  )
}
