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

  // For each month, aggregate values (sum numeric fields)
  const monthlyUpserts: Array<{
    user_id: string
    month: string
    cash_collected: number | null
    revenue_contracted: number | null
    new_followers: number | null
    meetings_booked: number | null
    clients_signed: number | null
    close_rate: number | null
  }> = []

  for (const [month, monthRows] of byMonth.entries()) {
    function sumOrNull(key: keyof ParsedRow): number | null {
      const vals = monthRows.map(r => r[key] as number | null).filter((v): v is number => v !== null)
      return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) : null
    }
    function avgOrNull(key: keyof ParsedRow): number | null {
      const vals = monthRows.map(r => r[key] as number | null).filter((v): v is number => v !== null)
      return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : null
    }

    monthlyUpserts.push({
      user_id: uid,
      month,
      cash_collected: sumOrNull('revenue'),
      revenue_contracted: sumOrNull('revenue'),
      new_followers: sumOrNull('followers_gained'),
      meetings_booked: sumOrNull('calls_booked'),
      clients_signed: sumOrNull('contracts_signed'),
      close_rate: avgOrNull('close_rate'),
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
