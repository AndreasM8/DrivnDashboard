import type { SupabaseClient } from '@supabase/supabase-js'

export interface WeeklyInsightContext {
  // This week
  cashCollected: number
  newContracts: number
  callsBooked: number
  showUpRate: number
  closeRate: number
  newFollowers: number
  leadsReplied: number
  // Last week
  lastWeekCashCollected: number
  lastWeekCallsBooked: number
  lastWeekCloseRate: number
  lastWeekNewFollowers: number
  // Ad spend / ROAS
  cashRoas: number | null
  adSpend: number | null
  // Targets
  cashTarget: number
  callsTarget: number
  closeRateTarget: number
}

export function getMonday(d: Date): string {
  const date = new Date(d)
  const day = date.getDay()
  const diff = date.getDate() - day + (day === 0 ? -6 : 1)
  date.setDate(diff)
  return date.toISOString().split('T')[0]
}

export function getLastMonday(d: Date): string {
  const thisMonday = new Date(getMonday(d))
  thisMonday.setDate(thisMonday.getDate() - 7)
  return thisMonday.toISOString().split('T')[0]
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

export async function getWeeklyInsightContext(
  userId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  adminClient: SupabaseClient<any, 'public', any>,
): Promise<WeeklyInsightContext> {
  const now = new Date()
  const thisWeekStart = getMonday(now)
  const thisWeekEnd = addDays(thisWeekStart, 7)
  const lastWeekStart = getLastMonday(now)
  const lastWeekEnd = thisWeekStart

  const thisWeekStartTs = `${thisWeekStart}T00:00:00.000Z`
  const thisWeekEndTs = `${thisWeekEnd}T00:00:00.000Z`
  const lastWeekStartTs = `${lastWeekStart}T00:00:00.000Z`
  const lastWeekEndTs = `${lastWeekEnd}T00:00:00.000Z`

  const [
    { data: targets },
    { data: thisWeekLeads },
    { data: lastWeekLeads },
    { data: thisWeekReplied },
    { data: lastWeekReplied },
    { data: thisWeekBooked },
    { data: lastWeekBooked },
    { data: thisWeekClients },
    { data: lastWeekClients },
    { data: thisWeekInstallments },
    { data: lastWeekInstallments },
    { data: adSpendLog },
  ] = await Promise.all([
    // KPI targets
    adminClient.from('kpi_targets').select('cash_target, meetings_target, close_rate_target').eq('user_id', userId).maybeSingle(),
    // New followers this week (leads created this week)
    adminClient.from('leads').select('id').eq('user_id', userId).gte('created_at', thisWeekStartTs).lt('created_at', thisWeekEndTs),
    // New followers last week
    adminClient.from('leads').select('id').eq('user_id', userId).gte('created_at', lastWeekStartTs).lt('created_at', lastWeekEndTs),
    // Leads replied this week (not in 'follower' stage, created this week)
    adminClient.from('leads').select('id').eq('user_id', userId).neq('stage', 'follower').gte('created_at', thisWeekStartTs).lt('created_at', thisWeekEndTs),
    // Leads replied last week
    adminClient.from('leads').select('id').eq('user_id', userId).neq('stage', 'follower').gte('created_at', lastWeekStartTs).lt('created_at', lastWeekEndTs),
    // Calls booked this week
    adminClient.from('leads').select('call_booked_at, call_outcome').eq('user_id', userId).gte('call_booked_at', thisWeekStartTs).lt('call_booked_at', thisWeekEndTs),
    // Calls booked last week
    adminClient.from('leads').select('call_booked_at, call_outcome').eq('user_id', userId).gte('call_booked_at', lastWeekStartTs).lt('call_booked_at', lastWeekEndTs),
    // New clients signed this week
    adminClient.from('clients').select('id, total_amount, payment_type, started_at').eq('user_id', userId).gte('started_at', thisWeekStart).lt('started_at', thisWeekEnd),
    // New clients signed last week
    adminClient.from('clients').select('id, total_amount, payment_type, started_at').eq('user_id', userId).gte('started_at', lastWeekStart).lt('started_at', lastWeekEnd),
    // Paid installments due this week (non-PIF)
    adminClient.from('payment_installments').select('amount, paid, clients!inner(user_id, payment_type)').eq('clients.user_id', userId).eq('paid', true).gte('due_date', thisWeekStart).lt('due_date', thisWeekEnd),
    // Paid installments last week
    adminClient.from('payment_installments').select('amount, paid, clients!inner(user_id, payment_type)').eq('clients.user_id', userId).eq('paid', true).gte('due_date', lastWeekStart).lt('due_date', lastWeekEnd),
    // Ad spend log for current month
    adminClient.from('ad_spend_log').select('month, actual_amount').eq('user_id', userId),
  ])

  // ── This week metrics ─────────────────────────────────────────────────────

  type BookedLead = { call_booked_at: string | null; call_outcome: string | null }
  type ClientRow = { id: string; total_amount: number; payment_type: string; started_at: string }
  type InstRow = { amount: number; paid: boolean; clients: { payment_type: string } }

  const thisBookedArr = (thisWeekBooked ?? []) as BookedLead[]
  const lastBookedArr = (lastWeekBooked ?? []) as BookedLead[]
  const thisClientsArr = (thisWeekClients ?? []) as ClientRow[]
  const lastClientsArr = (lastWeekClients ?? []) as ClientRow[]

  const thisWeekInsts = (thisWeekInstallments ?? []) as unknown as InstRow[]
  const lastWeekInsts = (lastWeekInstallments ?? []) as unknown as InstRow[]

  const thisWeekCallsBooked = thisBookedArr.length
  const lastWeekCallsBooked = lastBookedArr.length

  // Show-up rate: showed / (showed + no_show + canceled) for this week's booked calls
  const thisWithOutcome = thisBookedArr.filter(l => l.call_outcome)
  const thisShowed = thisWithOutcome.filter(l => l.call_outcome === 'showed').length
  const showUpRate = thisWithOutcome.length > 0 ? (thisShowed / thisWithOutcome.length) * 100 : 0

  // Close rate: clients signed / calls booked this week
  const thisNewContracts = thisClientsArr.length
  const closeRate = thisWeekCallsBooked > 0 ? (thisNewContracts / thisWeekCallsBooked) * 100 : 0

  // Last week close rate
  const lastNewContracts = lastClientsArr.length
  const lastWeekCloseRate = lastWeekCallsBooked > 0 ? (lastNewContracts / lastWeekCallsBooked) * 100 : 0

  // Cash collected this week: PIF clients + paid installments (non-PIF)
  const thisPifCash = thisClientsArr
    .filter(c => c.payment_type === 'pif')
    .reduce((s, c) => s + c.total_amount, 0)
  const thisPaidInsts = thisWeekInsts
    .filter(i => (i.clients as { payment_type: string })?.payment_type !== 'pif')
    .reduce((s, i) => s + i.amount, 0)
  const cashCollected = thisPifCash + thisPaidInsts

  // Last week cash
  const lastPifCash = lastClientsArr
    .filter(c => c.payment_type === 'pif')
    .reduce((s, c) => s + c.total_amount, 0)
  const lastPaidInsts = lastWeekInsts
    .filter(i => (i.clients as { payment_type: string })?.payment_type !== 'pif')
    .reduce((s, i) => s + i.amount, 0)
  const lastWeekCashCollected = lastPifCash + lastPaidInsts

  // Ad spend for current month
  const currentMonth = now.toISOString().slice(0, 7)
  type AdSpendRow = { month: string; actual_amount: number }
  const adSpendRows = (adSpendLog ?? []) as AdSpendRow[]
  const adSpendThisMonth = adSpendRows.filter(r => r.month === currentMonth).reduce((s, r) => s + r.actual_amount, 0)
  const adSpend = adSpendThisMonth > 0 ? adSpendThisMonth : null

  // ROAS: monthly cash / ad spend (only if ad spend exists)
  const cashRoas = adSpend && adSpend > 0 ? cashCollected / adSpend : null

  return {
    cashCollected,
    newContracts: thisNewContracts,
    callsBooked: thisWeekCallsBooked,
    showUpRate,
    closeRate,
    newFollowers: (thisWeekLeads ?? []).length,
    leadsReplied: (thisWeekReplied ?? []).length,
    lastWeekCashCollected,
    lastWeekCallsBooked,
    lastWeekCloseRate,
    lastWeekNewFollowers: (lastWeekLeads ?? []).length,
    cashRoas,
    adSpend,
    cashTarget: targets?.cash_target ?? 0,
    callsTarget: targets?.meetings_target ?? 0,
    closeRateTarget: targets?.close_rate_target ?? 0,
  }
}
