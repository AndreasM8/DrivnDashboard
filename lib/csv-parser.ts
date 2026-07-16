import type { ParsedColumn, ParsedRow } from '@/app/api/import/parse/route'

// ─── Record types for individual CRM entries ─────────────────────────────────

export interface ImportClientRecord {
  full_name: string
  program_type: string
  payment_type: 'pif' | 'split' | 'plan'
  total_amount: number
  monthly_amount: number | null
  plan_months: number | null
  total_paid: number
  started_at: string
}

export interface ImportLeadRecord {
  full_name: string
  ig_username: string
  source: string
  stage: 'follower' | 'replied' | 'call_booked' | 'nurture_post_call' | 'closed' | 'nurture' | 'bad_fit' | 'not_interested'
  followed_at: string | null
  call_booked_at: string | null
  call_outcome: 'showed' | 'no_show' | 'canceled' | 'rescheduled' | null
}

// ─── CSV Tokeniser ────────────────────────────────────────────────────────────

function tokenizeLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuote = false

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuote && line[i + 1] === '"') { current += '"'; i++ }
      else inQuote = !inQuote
    } else if (ch === ',' && !inQuote) {
      result.push(current.trim())
      current = ''
    } else {
      current += ch
    }
  }
  result.push(current.trim())
  return result
}

export function parseCsv(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = text.split(/\r?\n/).filter(l => l.trim())
  if (lines.length === 0) return { headers: [], rows: [] }

  const headers = tokenizeLine(lines[0])
  const rows: Record<string, string>[] = []

  for (let i = 1; i < lines.length; i++) {
    const values = tokenizeLine(lines[i])
    if (values.every(v => !v)) continue
    const row: Record<string, string> = {}
    headers.forEach((h, j) => { row[h] = values[j]?.trim() ?? '' })
    rows.push(row)
  }

  return { headers, rows }
}

// ─── Value Parsers ────────────────────────────────────────────────────────────

export function parseNumericValue(raw: string): number | null {
  const s = raw.trim()
  if (!s) return null
  const stripped = s.replace(/[^\d.,\-]/g, '')
  if (!stripped) return null

  const lastDot   = stripped.lastIndexOf('.')
  const lastComma = stripped.lastIndexOf(',')
  let normalized: string

  if (lastComma > lastDot) {
    normalized = stripped.replace(/\./g, '').replace(',', '.')
  } else {
    normalized = stripped.replace(/,/g, '')
  }

  const n = parseFloat(normalized)
  return isNaN(n) ? null : n
}

const MONTH_MAP: Record<string, string> = {
  jan:'01', feb:'02', mar:'03', apr:'04', may:'05', jun:'06',
  jul:'07', aug:'08', sep:'09', oct:'10', nov:'11', dec:'12',
  januar:'01', februar:'02', mars:'03', april:'04', mai:'05', juni:'06',
  juli:'07', august:'08', september:'09', oktober:'10', november:'11', desember:'12',
}

export function parseDateValue(raw: string): string | null {
  // Strip time component if present (e.g. "1/23/2026 0:00:00")
  const s = raw.trim().replace(/\s+\d{1,2}:\d{2}(:\d{2})?$/, '').trim()
  if (!s) return null

  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s

  // M/D/YYYY or MM/DD/YYYY (Google Sheets US format — treat as month/day/year)
  const mdy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (mdy) return `${mdy[3]}-${mdy[1].padStart(2,'0')}-${mdy[2].padStart(2,'0')}`

  // DD.MM.YYYY
  const dmy = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/)
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2,'0')}-${dmy[1].padStart(2,'0')}`

  // YYYY-MM
  const ym = s.match(/^(\d{4})-(\d{2})$/)
  if (ym) return `${ym[1]}-${ym[2]}-01`

  // "Jan 2025" / "January 2025" / "2025 Jan"
  const my = s.match(/^([a-zA-ZæøåÆØÅ]+)[.\s\-]*(\d{4})$/)
  if (my) {
    const m = MONTH_MAP[my[1].toLowerCase().slice(0, 3)]
    if (m) return `${my[2]}-${m}-01`
  }
  const ym2 = s.match(/^(\d{4})[.\s\-]*([a-zA-ZæøåÆØÅ]+)$/)
  if (ym2) {
    const m = MONTH_MAP[ym2[2].toLowerCase().slice(0, 3)]
    if (m) return `${ym2[1]}-${m}-01`
  }

  return null
}

// ─── Specialized Sheet Parsers ────────────────────────────────────────────────

function findCol(headers: string[], ...patterns: RegExp[]): string | undefined {
  return headers.find(h => {
    // Collapse all whitespace (incl. newlines from Google Sheets cell wrapping) to single space
    const normalized = h.replace(/\s+/g, ' ').trim()
    return patterns.some(p => p.test(normalized))
  })
}

const isChecked = (v: string) => /^(true|sann|sant|1|yes|ja|x|✓)$/i.test(v.trim())

export function parseFollowersSheet(
  headers: string[],
  rows: Record<string, string>[]
): { parsedRows: ParsedRow[]; columns: ParsedColumn[]; leadRecords: ImportLeadRecord[] } {
  const dateCol     = findCol(headers, /day.?follow/i, /date.?follow/i, /date/i, /dato/i)
    ?? headers[headers.length - 1]
  const handleCol   = findCol(headers, /instagram/i, /handle/i, /username/i, /ig/i, /name/i, /navn/i)
  const responseCol = findCol(headers, /response/i, /replied/i, /reply/i, /svar/i)

  const monthCounts = new Map<string, number>()
  const leadRecords: ImportLeadRecord[] = []

  for (const row of rows) {
    const date = parseDateValue(row[dateCol] ?? '')
    if (!date) continue
    const m = date.slice(0, 7)
    monthCounts.set(m, (monthCounts.get(m) ?? 0) + 1)

    const handle   = handleCol   ? (row[handleCol]   ?? '').trim() : ''
    const replied  = responseCol ? isChecked(row[responseCol] ?? '') : false

    if (handle) {
      leadRecords.push({
        full_name:      handle,
        ig_username:    handle,
        source:         'Instagram',
        stage:          replied ? 'replied' : 'follower',
        followed_at:    date,
        call_booked_at: null,
        call_outcome:   null,
      })
    }
  }

  const parsedRows: ParsedRow[] = [...monthCounts.entries()].sort().map(([m, count]) => ({
    id: crypto.randomUUID(),
    date: `${m}-01`,
    revenue: null, revenue_contracted: null, leads_count: null,
    calls_booked: null, calls_showed: null, show_up_rate: null, close_rate: null,
    ad_spend: null, contracts_signed: null, followers_gained: count,
    _originalValues: { Month: m, 'New followers': String(count) },
  }))

  return {
    parsedRows,
    leadRecords,
    columns: [
      { originalName: 'Month',         mappedTo: 'date',             hasData: true },
      { originalName: 'New followers', mappedTo: 'followers_gained', hasData: true },
    ],
  }
}

export function parseMeetingsSheet(
  headers: string[],
  rows: Record<string, string>[]
): { parsedRows: ParsedRow[]; columns: ParsedColumn[]; leadRecords: ImportLeadRecord[] } {
  const nameCol     = findCol(headers, /lead.?name/i, /name/i, /navn/i)
  const dateCol     = findCol(headers, /date.?of.?call/i, /call.?date/i, /date/i, /dato/i)
  // Numeric "Calls" column — lets users supply a count per month instead of one row per meeting
  const callsCol    = findCol(headers, /calls.?booked/i, /meetings.?booked/i, /total.?calls/i, /^calls$/i)
  const sourceCol   = findCol(headers, /source/i, /platform/i, /kanal/i)
  // "Calls showed" / "Showed up" — accepts a number (aggregate) or checkmark (per-meeting)
  const showedCol   = findCol(headers, /calls.?showed/i, /showed.?up/i, /show.?up/i, /showed/i, /møtt/i, /møtte/i, /attended/i)
  const noShowCol   = findCol(headers, /no.?show/i, /ikke.?møtt/i, /no.?møtt/i)
  const canceledCol = findCol(headers, /cancel/i, /avlys/i)
  const reschedCol  = findCol(headers, /reschedul/i, /utsatt/i)
  const closedCol   = findCol(headers, /closed/i, /lukket/i, /signert/i, /close/i)

  type Acc = { calls: number; showed: number; closed: number }
  const byMonth = new Map<string, Acc>()
  const leadRecords: ImportLeadRecord[] = []

  for (const row of rows) {
    const date = dateCol ? parseDateValue(row[dateCol] ?? '') : null
    if (!date) continue
    const m = date.slice(0, 7)
    const acc = byMonth.get(m) ?? { calls: 0, showed: 0, closed: 0 }

    // Calls: use explicit numeric column if present, else count this row as one meeting
    if (callsCol) {
      const n = parseNumericValue(row[callsCol] ?? '')
      acc.calls += n !== null ? n : 1
    } else {
      acc.calls++
    }

    // Showed: numeric value (aggregate format) or checkmark (per-meeting format)
    if (showedCol) {
      const raw = (row[showedCol] ?? '').trim()
      const n = parseNumericValue(raw)
      if (n !== null) acc.showed += n
      else if (isChecked(raw)) acc.showed++
    }

    // Closed: numeric value (aggregate format) or checkmark (per-meeting format)
    if (closedCol) {
      const raw = (row[closedCol] ?? '').trim()
      const n = parseNumericValue(raw)
      if (n !== null) acc.closed += n
      else if (isChecked(raw)) acc.closed++
    }

    byMonth.set(m, acc)

    // Lead records only in per-meeting format (when a name is present in the row)
    const name = nameCol ? (row[nameCol] ?? '').trim() : ''
    if (!name) continue

    const isClosed = closedCol && isChecked(row[closedCol] ?? '')

    let call_outcome: ImportLeadRecord['call_outcome'] = null
    if      (showedCol   && isChecked(row[showedCol]   ?? '')) call_outcome = 'showed'
    else if (noShowCol   && isChecked(row[noShowCol]   ?? '')) call_outcome = 'no_show'
    else if (canceledCol && isChecked(row[canceledCol] ?? '')) call_outcome = 'canceled'
    else if (reschedCol  && isChecked(row[reschedCol]  ?? '')) call_outcome = 'rescheduled'

    const stage: ImportLeadRecord['stage'] = isClosed ? 'closed' : 'nurture_post_call'

    leadRecords.push({
      full_name:      name,
      ig_username:    name,
      source:         sourceCol ? (row[sourceCol] ?? '').replace(/[^\w\s]/g, '').trim() : 'Instagram',
      stage,
      followed_at:    null,
      call_booked_at: date,
      call_outcome,
    })
  }

  const parsedRows: ParsedRow[] = [...byMonth.entries()].sort().map(([m, acc]) => {
    return {
      id: crypto.randomUUID(),
      date: `${m}-01`,
      revenue: null, revenue_contracted: null, leads_count: null,
      calls_booked: acc.calls,
      calls_showed: showedCol !== undefined ? acc.showed : null,
      show_up_rate: null,
      close_rate: null, ad_spend: null,
      contracts_signed: acc.closed,
      followers_gained: null,
      _originalValues: {
        Month: m,
        'Meetings booked': String(acc.calls),
        'Calls showed': String(acc.showed),
        'Contracts signed': String(acc.closed),
      },
    }
  })

  return {
    parsedRows,
    leadRecords,
    columns: [
      { originalName: 'Month',             mappedTo: 'date',             hasData: true },
      { originalName: 'Meetings booked',   mappedTo: 'calls_booked',     hasData: true },
      { originalName: 'Calls showed',      mappedTo: 'calls_showed',     hasData: showedCol !== undefined },
      { originalName: 'Contracts signed',  mappedTo: 'contracts_signed', hasData: closedCol !== undefined },
    ],
  }
}

function parsePlanMonths(raw: string): number | null {
  const n = parseInt(raw.replace(/[^\d]/g, ''), 10)
  return isNaN(n) ? null : n
}

export function parseSalesSheet(
  headers: string[],
  rows: Record<string, string>[]
): { parsedRows: ParsedRow[]; columns: ParsedColumn[]; clientRecords: ImportClientRecord[] } {
  const nameCol    = findCol(headers, /client.?name/i, /name/i, /navn/i)
  const dateCol    = findCol(headers, /date.?of.?close/i, /close.?date/i, /date/i, /dato/i)
  const dealCol    = findCol(headers, /deal.?size/i, /deal.?verdi/i, /size/i, /amount/i)
  const cashCol    = findCol(headers, /cash.?collect/i, /innbetalt/i, /collected/i)
  const payTypeCol = findCol(headers, /type.?of.?pay/i, /payment.?type/i, /pay.?type/i, /betalings/i)
  const offerCol   = findCol(headers, /offer.?type/i, /program/i, /type/i)
  const lengthCol  = findCol(headers, /deal.?length/i, /length/i, /mnd/i, /months/i)

  const isKlarna  = (v: string) => /klarna/i.test(v.trim())
  const isPlan    = (v: string) => /plan/i.test(v.trim())

  type Acc = { contracted: number; cash: number; count: number }
  const byMonth = new Map<string, Acc>()
  const clientRecords: ImportClientRecord[] = []

  for (const row of rows) {
    const date = dateCol ? parseDateValue(row[dateCol] ?? '') : null
    if (!date) continue
    const m = date.slice(0, 7)
    const acc = byMonth.get(m) ?? { contracted: 0, cash: 0, count: 0 }
    acc.count++

    const deal    = dealCol    ? parseNumericValue(row[dealCol]    ?? '') : null
    const cashRaw = cashCol    ? parseNumericValue(row[cashCol]    ?? '') : null
    const payType = payTypeCol ? (row[payTypeCol] ?? '').trim()           : ''
    const offer   = offerCol   ? (row[offerCol]   ?? '').trim()           : ''
    const name    = nameCol    ? (row[nameCol]    ?? '').trim()           : ''

    if (deal !== null) acc.contracted += deal

    const klarna = isKlarna(payType)
    const cashForMonth = klarna && deal !== null ? deal : (cashRaw ?? 0)
    acc.cash += cashForMonth

    byMonth.set(m, acc)

    // Build individual client record (skip placeholder / empty rows)
    if (name && name.toLowerCase() !== 'client name' && deal !== null && deal > 0) {
      const planMonths  = lengthCol ? parsePlanMonths(row[lengthCol] ?? '') : null
      const payTypeMapped: ImportClientRecord['payment_type'] =
        klarna ? 'pif' : isPlan(payType) ? 'plan' : 'split'
      const monthly = payTypeMapped === 'plan' && planMonths
        ? Math.round(deal / planMonths)
        : null

      clientRecords.push({
        full_name:     name,
        program_type:  offer,
        payment_type:  payTypeMapped,
        total_amount:  deal,
        monthly_amount: monthly,
        plan_months:   planMonths,
        total_paid:    klarna && deal !== null ? deal : (cashRaw ?? 0),
        started_at:    date,
      })
    }
  }

  const hasCash = [...byMonth.values()].some(a => a.cash > 0)
  const hasDeal = [...byMonth.values()].some(a => a.contracted > 0)

  const parsedRows: ParsedRow[] = [...byMonth.entries()].sort().map(([m, acc]) => ({
    id: crypto.randomUUID(),
    date: `${m}-01`,
    revenue:             hasCash ? acc.cash        : null,
    revenue_contracted:  hasDeal ? acc.contracted  : null,
    leads_count: null, calls_booked: null, calls_showed: null, show_up_rate: null, close_rate: null,
    ad_spend: null,
    contracts_signed: acc.count,
    followers_gained: null,
    _originalValues: {
      Month: m,
      'Cash collected': String(acc.cash),
      'Revenue contracted': String(acc.contracted),
      'Clients signed': String(acc.count),
    },
  }))

  return {
    parsedRows,
    clientRecords,
    columns: [
      { originalName: 'Month',               mappedTo: 'date',                hasData: true },
      { originalName: 'Cash collected',      mappedTo: 'revenue',             hasData: hasCash },
      { originalName: 'Revenue contracted',  mappedTo: 'revenue_contracted',  hasData: hasDeal },
      { originalName: 'Clients signed',      mappedTo: 'contracts_signed',    hasData: true },
    ],
  }
}

// ─── Apply Mapping ────────────────────────────────────────────────────────────

export function applyColumnMapping(
  columns: ParsedColumn[],
  rows: Record<string, string>[]
): ParsedRow[] {
  return rows.map(row => {
    const result: ParsedRow = {
      id: crypto.randomUUID(),
      date: null,
      revenue: null,
      revenue_contracted: null,
      leads_count: null,
      calls_booked: null,
      calls_showed: null,
      show_up_rate: null,
      close_rate: null,
      ad_spend: null,
      contracts_signed: null,
      followers_gained: null,
      _originalValues: row,
    }
    for (const col of columns) {
      if (col.mappedTo === 'ignore') continue
      const raw = row[col.originalName] ?? ''
      if (col.mappedTo === 'date') {
        result.date = parseDateValue(raw)
      } else {
        result[col.mappedTo] = parseNumericValue(raw)
      }
    }
    return result
  })
}
