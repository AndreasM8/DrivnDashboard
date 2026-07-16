import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getEffectiveUserId } from '@/lib/admin'
import type { ParsedRow } from '../parse/route'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ConfirmPayload {
  rows: ParsedRow[]
  adSpendDistribution: 'equal' | 'none'
  totalAdSpend: number | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toMonth(isoDate: string): string {
  // "2025-01-15" → "2025-01"
  return isoDate.slice(0, 7)
}

function countMonthsBetween(start: string, end: string): number {
  // start and end are "YYYY-MM"
  const [sy, sm] = start.split('-').map(Number)
  const [ey, em] = end.split('-').map(Number)
  return (ey - sy) * 12 + (em - sm) + 1
}

function monthsBetween(start: string, end: string): string[] {
  const months: string[] = []
  const [sy, sm] = start.split('-').map(Number)
  const [ey, em] = end.split('-').map(Number)
  let y = sy, m = sm
  while (y < ey || (y === ey && m <= em)) {
    months.push(`${y}-${String(m).padStart(2, '0')}`)
    m++
    if (m > 12) { m = 1; y++ }
  }
  return months
}

// ─── Route Handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const uid = await getEffectiveUserId()

  let payload: ConfirmPayload
  try {
    payload = await req.json() as ConfirmPayload
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { rows, adSpendDistribution, totalAdSpend } = payload

  // Filter rows with dates only
  const validRows = rows.filter(r => r.date !== null)
  if (validRows.length === 0) {
    return NextResponse.json({ error: 'No rows with valid dates' }, { status: 400 })
  }

  // Group rows by month
  const byMonth = new Map<string, ParsedRow[]>()
  for (const row of validRows) {
    const month = toMonth(row.date!)
    const existing = byMonth.get(month) ?? []
    existing.push(row)
    byMonth.set(month, existing)
  }

  // Fetch existing snapshots so we can merge rather than overwrite
  const allMonths = [...byMonth.keys()]
  const { data: existingSnapshots } = await supabase
    .from('monthly_snapshots')
    .select('month, cash_collected, revenue_contracted, new_followers, meetings_booked, clients_signed, close_rate, show_up_rate')
    .eq('user_id', uid)
    .in('month', allMonths)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const existingByMonth = new Map<string, any>(
    (existingSnapshots ?? []).map(s => [s.month, s])
  )

  // For each month, aggregate values (sum numeric fields)
  const monthlyUpserts: Array<Record<string, unknown>> = []

  for (const [month, monthRows] of byMonth.entries()) {
    function sumOrNull(key: keyof ParsedRow): number | null {
      const vals = monthRows.map(r => r[key] as number | null).filter((v): v is number => v !== null)
      return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) : null
    }
    function avgOrNull(key: keyof ParsedRow): number | null {
      const vals = monthRows.map(r => r[key] as number | null).filter((v): v is number => v !== null)
      return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : null
    }

    const ex             = existingByMonth.get(month)
    const revContracted  = sumOrNull('revenue_contracted')
    const revCash        = sumOrNull('revenue')

    // Compute show_up_rate: prefer calls_showed / calls_booked (raw counts), fall back to explicit rate
    const callsBooked  = sumOrNull('calls_booked')
    const callsShowed  = sumOrNull('calls_showed')
    const showUpRate   = callsShowed !== null && callsBooked
      ? Math.round((callsShowed / callsBooked) * 100)
      : avgOrNull('show_up_rate')

    // Merge: new value wins if non-null, otherwise keep existing, all columns are NOT NULL DEFAULT 0
    monthlyUpserts.push({
      user_id:            uid,
      month,
      cash_collected:     revCash        ?? ex?.cash_collected     ?? 0,
      revenue_contracted: revContracted  ?? ex?.revenue_contracted ?? revCash ?? ex?.cash_collected ?? 0,
      new_followers:      sumOrNull('followers_gained') ?? ex?.new_followers   ?? 0,
      meetings_booked:    callsBooked                  ?? ex?.meetings_booked ?? 0,
      clients_signed:     sumOrNull('contracts_signed') ?? ex?.clients_signed  ?? 0,
      close_rate:         avgOrNull('close_rate')       ?? ex?.close_rate      ?? 0,
      show_up_rate:       showUpRate                   ?? ex?.show_up_rate    ?? 0,
    })
  }

  // Upsert monthly_snapshots
  const { error: snapshotError } = await supabase
    .from('monthly_snapshots')
    .upsert(monthlyUpserts, { onConflict: 'user_id,month' })

  if (snapshotError) {
    console.error('[import/confirm] snapshot upsert error:', snapshotError)
    return NextResponse.json({ error: snapshotError.message }, { status: 500 })
  }

  // Handle ad spend
  const expenseInserts: Array<{
    user_id: string
    month: string
    category: string
    label: string
    amount: number
    currency: string
  }> = []

  const sortedMonths = [...byMonth.keys()].sort()

  if (adSpendDistribution === 'equal' && totalAdSpend && totalAdSpend > 0 && sortedMonths.length > 0) {
    // Distribute equally across months spanned
    const firstMonth = sortedMonths[0]
    const lastMonth = sortedMonths[sortedMonths.length - 1]
    const allMonths = monthsBetween(firstMonth, lastMonth)
    const perMonth = totalAdSpend / allMonths.length
    for (const month of allMonths) {
      expenseInserts.push({
        user_id: uid,
        month,
        category: 'ads',
        label: 'Imported ad spend',
        amount: Math.round(perMonth * 100) / 100,
        currency: 'NOK',
      })
    }
  } else {
    // Insert individual ad spend rows that have dates
    for (const row of validRows) {
      if (row.ad_spend !== null && row.ad_spend > 0) {
        expenseInserts.push({
          user_id: uid,
          month: toMonth(row.date!),
          category: 'ads',
          label: 'Imported ad spend',
          amount: row.ad_spend,
          currency: 'NOK',
        })
      }
    }
  }

  if (expenseInserts.length > 0) {
    const { error: expenseError } = await supabase.from('expenses').insert(expenseInserts)
    if (expenseError) {
      console.error('[import/confirm] expense insert error:', expenseError)
      // Non-fatal — snapshot import succeeded
    }
  }

  const importedMonths = [...byMonth.keys()].sort()
  return NextResponse.json({
    imported: importedMonths.length,
    months: importedMonths,
  })
}
