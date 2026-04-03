import { createServerSupabaseClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import NumbersClient from './NumbersClient'
import type { KpiTargets, MonthlySnapshot, Client, PaymentInstallment, Expense } from '@/types'

export default async function NumbersPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const now = new Date()
  const currentMonth = now.toISOString().slice(0, 7)
  // monthStart as date-only string (for DATE fields like started_at)
  const monthStart = `${currentMonth}-01`
  // monthStartTs as full ISO for Supabase timestamptz field queries
  const monthStartTs = `${currentMonth}-01T00:00:00.000Z`
  const nextMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString().slice(0, 10)
  const lastMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1)).toISOString().slice(0, 7)

  const [
    { data: profile },
    { data: targets },
    { data: snapshots },
    { data: clients },
    { data: installments },
    { data: newLeads },
    { data: bookedLeads },
    { data: allMonthInstallments },
    { data: expenses },
    { data: adSpend },
  ] = await Promise.all([
    supabase.from('users').select('base_currency, name').eq('id', user.id).single(),
    supabase.from('kpi_targets').select('*').eq('user_id', user.id).single(),
    supabase.from('monthly_snapshots').select('*').eq('user_id', user.id).order('month', { ascending: false }).limit(7),
    supabase.from('clients').select('*').eq('user_id', user.id).eq('active', true),
    // Join through clients so RLS + explicit user filter both apply
    supabase.from('payment_installments').select('*, clients!inner(user_id)').eq('clients.user_id', user.id),
    // All leads created this month = new followers
    supabase.from('leads').select('id').eq('user_id', user.id).gte('created_at', monthStartTs),
    // All leads with a call booked OR outcome this month (regardless of when lead was created)
    supabase.from('leads').select('call_booked_at, call_outcome, updated_at').eq('user_id', user.id)
      .or(`call_booked_at.gte.${monthStartTs},and(call_outcome.not.is.null,updated_at.gte.${monthStartTs})`),
    // Installments DUE this month (paid + unpaid) — joined through clients for explicit user scoping
    supabase.from('payment_installments')
      .select('amount, due_date, paid, paid_at, clients!inner(user_id)')
      .eq('clients.user_id', user.id)
      .gte('due_date', monthStart)
      .lt('due_date', nextMonthStart),
    // Expenses for current month
    supabase.from('expenses').select('*').eq('user_id', user.id).eq('month', currentMonth).order('created_at', { ascending: true }),
    // Ad spend log for current month
    supabase.from('ad_spend_log').select('actual_amount').eq('user_id', user.id).eq('month', currentMonth),
  ])

  // ── Build live current-month snapshot from real data ──────────────────────
  const monthClients = (clients ?? []).filter(c =>
    (c as Client).started_at >= monthStart
  ) as Client[]

  const revenueContracted = monthClients.reduce((s, c) => s + c.total_amount, 0)

  // PIF clients who started this month — their full amount is collected upfront (no installments)
  const cashFromPIF = monthClients
    .filter(c => c.payment_type === 'pif')
    .reduce((s, c) => s + c.total_amount, 0)

  // All installments DUE this month (plan + split clients)
  const monthDueInsts = (allMonthInstallments ?? []) as { amount: number; paid: boolean }[]
  const cashFromDueInstallments = monthDueInsts.reduce((s, i) => s + i.amount, 0)
  const cashFromPaidInstallments = monthDueInsts.filter(i => i.paid).reduce((s, i) => s + i.amount, 0)

  // cashCollected = total revenue due this month (PIF + all installments due)
  const cashCollected = cashFromPIF + cashFromDueInstallments
  // cashPending = installments due but not yet confirmed
  const cashPending = cashFromDueInstallments - cashFromPaidInstallments

  // Leads metrics — correct scoping
  const newFollowers = (newLeads ?? []).length  // all leads created this month
  const allBookedLeads = bookedLeads ?? []
  const meetingsBooked = allBookedLeads.filter((l: { call_booked_at: string | null }) => l.call_booked_at && l.call_booked_at >= monthStartTs).length
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

  const lastMonthSnapshot = snapshots?.find(s => s.month === lastMonth)

  const adSpendTotal = (adSpend ?? []).reduce((sum, row) => sum + ((row as { actual_amount: number }).actual_amount ?? 0), 0)

  // ── All-time / current business overview (all active clients, not just this month) ──
  const allClients = (clients ?? []) as Client[]
  const allInstallments = (installments ?? []) as PaymentInstallment[]
  const totalActiveClients = allClients.length
  const totalContracted = allClients.reduce((s, c) => s + c.total_amount, 0)
  // PIF clients: paid in full upfront, no installments — count their total_amount directly
  // Split + plan clients: revenue comes entirely from their installments (paid or unpaid)
  // Never mix total_amount + installments for the same client — that double-counts
  const totalCashCollected = allClients
    .filter(c => c.payment_type === 'pif')
    .reduce((s, c) => s + c.total_amount, 0)
    + allInstallments.filter(i => i.paid).reduce((s, i) => s + i.amount, 0)
  const totalOutstanding = allInstallments
    .filter(i => !i.paid)
    .reduce((s, i) => s + i.amount, 0)

  return (
    <NumbersClient
      baseCurrency={profile?.base_currency ?? 'NOK'}
      targets={(targets as KpiTargets) ?? null}
      currentSnapshot={liveSnapshot}
      lastMonthSnapshot={(lastMonthSnapshot as MonthlySnapshot) ?? null}
      history={(snapshots as MonthlySnapshot[]) ?? []}
      clients={allClients}
      installments={allInstallments}
      currentMonth={currentMonth}
      expenses={(expenses as Expense[]) ?? []}
      adSpendTotal={adSpendTotal}
      totalActiveClients={totalActiveClients}
      totalContracted={totalContracted}
      totalCashCollected={totalCashCollected}
      totalOutstanding={totalOutstanding}
      cashPending={cashPending}
    />
  )
}
