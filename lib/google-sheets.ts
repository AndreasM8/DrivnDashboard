import { google, sheets_v4 } from 'googleapis'
import { createServerSupabaseClient } from './supabase-server'
import type { Lead, Client, Setter, AdSpendLog, MonthlySnapshot, PaymentInstallment, Expense } from '@/types'

// ─── OAuth client ─────────────────────────────────────────────────────────────

export function getOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.NEXT_PUBLIC_APP_URL}/api/google/callback`
  )
}

export function getAuthUrl() {
  const oauth2 = getOAuthClient()
  return oauth2.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: [
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/drive.file',
    ],
  })
}

// ─── Token helpers ────────────────────────────────────────────────────────────

interface TokenRow {
  access_token: string
  refresh_token: string
  token_expiry: string
  spreadsheet_id: string | null
  spreadsheet_url: string | null
  last_synced_at: string | null
}

export async function getAuthClientForUser(userId: string) {
  const supabase = await createServerSupabaseClient()
  const { data } = await supabase
    .from('google_integrations')
    .select('access_token, refresh_token, token_expiry')
    .eq('user_id', userId)
    .single()

  if (!data) return null

  const oauth2 = getOAuthClient()
  oauth2.setCredentials({
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expiry_date: new Date(data.token_expiry).getTime(),
  })

  oauth2.on('tokens', async (tokens) => {
    if (tokens.access_token) {
      await supabase.from('google_integrations').update({
        access_token: tokens.access_token,
        token_expiry: tokens.expiry_date
          ? new Date(tokens.expiry_date).toISOString()
          : new Date(Date.now() + 3600 * 1000).toISOString(),
      }).eq('user_id', userId)
    }
  })

  return oauth2
}

export async function getIntegration(userId: string): Promise<TokenRow | null> {
  const supabase = await createServerSupabaseClient()
  const { data } = await supabase
    .from('google_integrations')
    .select('access_token, refresh_token, token_expiry, spreadsheet_id, spreadsheet_url, last_synced_at')
    .eq('user_id', userId)
    .single()
  return data as TokenRow | null
}

// ─── Color helpers ────────────────────────────────────────────────────────────

function rgb(r: number, g: number, b: number) {
  return { red: r / 255, green: g / 255, blue: b / 255 }
}

const C = {
  black:       rgb(18, 18, 18),
  darkGray:    rgb(40, 40, 40),
  midGray:     rgb(66, 66, 66),
  lightGray:   rgb(245, 245, 245),
  medGray:     rgb(224, 224, 224),
  white:       rgb(255, 255, 255),
  darkGreen:   rgb(27, 94, 32),
  midGreen:    rgb(46, 125, 50),
  lightGreen:  rgb(200, 230, 201),
  darkBlue:    rgb(13, 71, 161),
  midBlue:     rgb(25, 118, 210),
  lightBlue:   rgb(187, 222, 251),
  darkRed:     rgb(183, 28, 28),
  midRed:      rgb(211, 47, 47),
  lightRed:    rgb(255, 205, 210),
  amber:       rgb(255, 193, 7),
  lightAmber:  rgb(255, 236, 153),
  orange:      rgb(230, 81, 0),
  lightOrange: rgb(255, 224, 178),
  tier1:       rgb(255, 205, 210),  // red light
  tier2:       rgb(255, 236, 153),  // amber light
  tier3:       rgb(255, 224, 178),  // orange light
}

// ─── Request builders ─────────────────────────────────────────────────────────

type Color = typeof C.black

function headerFmt(sheetId: number, numCols: number, bg: Color, fg: Color = C.white, fontSize = 10): sheets_v4.Schema$Request {
  return {
    repeatCell: {
      range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: numCols },
      cell: {
        userEnteredFormat: {
          backgroundColor: bg,
          textFormat: { bold: true, foregroundColor: fg, fontSize },
          verticalAlignment: 'MIDDLE',
          horizontalAlignment: 'CENTER',
          wrapStrategy: 'WRAP',
        },
      },
      fields: 'userEnteredFormat(backgroundColor,textFormat,verticalAlignment,horizontalAlignment,wrapStrategy)',
    },
  }
}

function freezeRow(sheetId: number, count = 1): sheets_v4.Schema$Request {
  return {
    updateSheetProperties: {
      properties: { sheetId, gridProperties: { frozenRowCount: count } },
      fields: 'gridProperties.frozenRowCount',
    },
  }
}

function colW(sheetId: number, col: number, px: number): sheets_v4.Schema$Request {
  return {
    updateDimensionProperties: {
      range: { sheetId, dimension: 'COLUMNS', startIndex: col, endIndex: col + 1 },
      properties: { pixelSize: px },
      fields: 'pixelSize',
    },
  }
}

function rowH(sheetId: number, row: number, px: number): sheets_v4.Schema$Request {
  return {
    updateDimensionProperties: {
      range: { sheetId, dimension: 'ROWS', startIndex: row, endIndex: row + 1 },
      properties: { pixelSize: px },
      fields: 'pixelSize',
    },
  }
}

function cellFmt(
  sheetId: number, r1: number, c1: number, r2: number, c2: number,
  fmt: sheets_v4.Schema$CellFormat
): sheets_v4.Schema$Request {
  const fields = Object.keys(fmt).join(',')
  return {
    repeatCell: {
      range: { sheetId, startRowIndex: r1, endRowIndex: r2, startColumnIndex: c1, endColumnIndex: c2 },
      cell: { userEnteredFormat: fmt },
      fields: `userEnteredFormat(${fields})`,
    },
  }
}

function cellBg(sheetId: number, row: number, col: number, color: Color): sheets_v4.Schema$Request {
  return cellFmt(sheetId, row, col, row + 1, col + 1, { backgroundColor: color })
}

function rangeBg(sheetId: number, r1: number, c1: number, r2: number, c2: number, color: Color): sheets_v4.Schema$Request {
  return cellFmt(sheetId, r1, c1, r2, c2, { backgroundColor: color })
}

function autoFilter(sheetId: number, numCols: number): sheets_v4.Schema$Request {
  return {
    setBasicFilter: {
      filter: { range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: numCols } },
    },
  }
}

function merge(sheetId: number, r1: number, c1: number, r2: number, c2: number): sheets_v4.Schema$Request {
  return {
    mergeCells: {
      range: { sheetId, startRowIndex: r1, endRowIndex: r2, startColumnIndex: c1, endColumnIndex: c2 },
      mergeType: 'MERGE_ALL',
    },
  }
}

function borders(sheetId: number, r1: number, c1: number, r2: number, c2: number): sheets_v4.Schema$Request {
  const b = { style: 'SOLID', color: rgb(200, 200, 200) }
  return {
    updateBorders: {
      range: { sheetId, startRowIndex: r1, endRowIndex: r2, startColumnIndex: c1, endColumnIndex: c2 },
      top: b, bottom: b, left: b, right: b, innerHorizontal: b, innerVertical: b,
    },
  }
}

// ─── Sheet management ─────────────────────────────────────────────────────────

async function getOrCreateSheet(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
  title: string,
  tabColor?: Color
): Promise<number> {
  const meta = await sheets.spreadsheets.get({ spreadsheetId })
  const existing = meta.data.sheets?.find(s => s.properties?.title === title)
  if (existing?.properties?.sheetId != null) return existing.properties.sheetId

  const res = await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [{ addSheet: { properties: { title, tabColor: tabColor ?? C.midGreen } } }],
    },
  })
  return res.data.replies?.[0]?.addSheet?.properties?.sheetId ?? 0
}

async function clearSheet(sheets: sheets_v4.Sheets, spreadsheetId: string, title: string) {
  try {
    await sheets.spreadsheets.values.clear({ spreadsheetId, range: `'${title}'!A:ZZ` })
  } catch { /* sheet may not exist yet */ }
}

async function write(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
  title: string,
  rows: (string | number | boolean | null)[][]
) {
  if (rows.length === 0) return
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `'${title}'!A1`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: rows },
  })
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null): string {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function pct(n: number): string {
  return `${n.toFixed(2)}%`
}

function check(v: boolean): string {
  return v ? '✓' : ''
}

const STAGE_LABEL: Record<string, string> = {
  follower: 'Follower', replied: 'Replied', freebie_sent: 'Freebie sent',
  call_booked: 'Call booked', closed: 'Closed', nurture: 'Nurture',
  bad_fit: 'Bad fit', not_interested: 'Not interested',
}

// ─── 1. Pipeline sheet ────────────────────────────────────────────────────────

async function buildPipelineSheet(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
  leads: Lead[],
  setters: Setter[]
) {
  const title = 'Sales Pipeline'
  const sheetId = await getOrCreateSheet(sheets, spreadsheetId, title, C.darkGray)
  await clearSheet(sheets, spreadsheetId, title)

  const setterMap = Object.fromEntries(setters.map(s => [s.id, s.name]))

  const OBJECTION_LABEL: Record<string, string> = {
    money: 'Money', partner: 'Partner / spouse', timing: 'Timing',
    trust: 'Trust', other: 'Other',
  }

  const headers = [
    'IG Handle', 'Full Name', 'Tier', 'Stage',
    'Setter', 'Setter Notes',
    'Day Followed', 'Last Contact',
    'Offer Sent', 'Meeting Booked', 'Booking Date',
    'Showed Up', 'No Show', 'Canceled', 'Rescheduled',
    'Closed', 'Objection', 'Closer Notes',
    'Bad Fit', 'Long Term Nurture',
  ]

  const dataRows = leads.map(l => {
    const t = l.tier
    return [
      l.ig_username,
      l.full_name,
      t ? `Tier ${t}` : '',
      STAGE_LABEL[l.stage] ?? l.stage,
      l.setter_id ? (setterMap[l.setter_id] ?? '') : '',
      l.setter_notes,
      fmtDate(l.created_at),
      fmtDate(l.last_contact_at),
      check(!!l.freebie_sent_at),
      check(!!l.call_booked_at),
      fmtDate(l.call_booked_at),
      check(l.call_outcome === 'showed'),
      check(l.call_outcome === 'no_show'),
      check(l.call_outcome === 'canceled'),
      check(l.call_outcome === 'rescheduled'),
      check(l.call_closed),
      l.call_objection ? (OBJECTION_LABEL[l.call_objection] ?? l.call_objection) : '',
      l.call_notes,
      check(l.stage === 'bad_fit'),
      check(l.stage === 'nurture'),
    ]
  })

  await write(sheets, spreadsheetId, title, [headers, ...dataRows])

  const requests: sheets_v4.Schema$Request[] = [
    headerFmt(sheetId, headers.length, C.darkGray),
    freezeRow(sheetId),
    autoFilter(sheetId, headers.length),
    colW(sheetId, 0, 160), colW(sheetId, 1, 150), colW(sheetId, 2, 80),
    colW(sheetId, 3, 120), colW(sheetId, 4, 100), colW(sheetId, 5, 220),
    colW(sheetId, 6, 110), colW(sheetId, 7, 110),
    colW(sheetId, 8, 90),  colW(sheetId, 9, 110),  colW(sheetId, 10, 110),
    colW(sheetId, 11, 90), colW(sheetId, 12, 80),  colW(sheetId, 13, 85),
    colW(sheetId, 14, 95), colW(sheetId, 15, 65),
    colW(sheetId, 16, 140), colW(sheetId, 17, 220),
    colW(sheetId, 18, 70),  colW(sheetId, 19, 120),
  ]

  dataRows.forEach((_, i) => {
    const row = i + 1
    const lead = leads[i]
    const tier = lead.tier

    // Alternating row bg
    if (i % 2 === 1) requests.push(rangeBg(sheetId, row, 0, row + 1, headers.length, C.lightGray))

    // Tier color
    if (tier === 1) requests.push(cellBg(sheetId, row, 2, C.tier1))
    else if (tier === 2) requests.push(cellBg(sheetId, row, 2, C.tier2))
    else if (tier === 3) requests.push(cellBg(sheetId, row, 2, C.tier3))

    // Closed = green row highlight
    if (lead.call_closed) {
      requests.push(rangeBg(sheetId, row, 0, row + 1, headers.length, C.lightGreen))
    }

    // Bad fit = red row
    if (lead.stage === 'bad_fit') {
      requests.push(rangeBg(sheetId, row, 0, row + 1, headers.length, C.lightRed))
    }

    // Objection cell — amber if present
    if (lead.call_objection) requests.push(cellBg(sheetId, row, 16, C.lightAmber))

    // ✓ cells — center align
    for (let c = 8; c <= 15; c++) {
      requests.push(cellFmt(sheetId, row, c, row + 1, c + 1, { horizontalAlignment: 'CENTER' }))
    }
    requests.push(cellFmt(sheetId, row, 18, row + 1, 20, { horizontalAlignment: 'CENTER' }))
  })

  await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests } })
}

// ─── 2. Clients sheet ─────────────────────────────────────────────────────────

async function buildClientsSheet(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
  clients: Client[],
  installments: PaymentInstallment[],
  setters: Setter[]
) {
  const title = 'Clients Overview'
  const sheetId = await getOrCreateSheet(sheets, spreadsheetId, title, C.darkGray)
  await clearSheet(sheets, spreadsheetId, title)

  const setterMap = Object.fromEntries(setters.map(s => [s.id, s.name]))

  // Build installment map: client_id → { paid, total }
  const instMap: Record<string, { paid: number; total: number }> = {}
  for (const inst of installments) {
    if (!instMap[inst.client_id]) instMap[inst.client_id] = { paid: 0, total: 0 }
    instMap[inst.client_id].total += inst.amount
    if (inst.paid) instMap[inst.client_id].paid += inst.amount
  }

  const headers = [
    'Client Name', 'Offer Type', 'Deal Size', 'Deal Length',
    'Type of Payment', 'Cash Collected', 'To Be Paid',
    'Backend Rev', 'Client LTV (months)',
    'Closer', 'Started', 'Active', 'Notes',
  ]

  const paymentLabel: Record<string, string> = {
    pif: 'Paid in Full', split: 'Split', plan: 'Payment Plan',
  }

  const dataRows = clients.map(c => {
    const inst = instMap[c.id]
    const cashCollected = inst?.paid ?? (c.payment_type === 'pif' ? c.total_amount : 0)
    const toBePaid = c.total_amount - cashCollected
    const offerLabel = c.plan_months
      ? `$${c.total_amount.toLocaleString()}-${c.plan_months}M`
      : `$${c.total_amount.toLocaleString()}`

    return [
      c.full_name || c.ig_username,
      offerLabel,
      c.total_amount,
      c.plan_months ? `${c.plan_months} months` : (c.payment_type === 'pif' ? 'One-time' : '—'),
      paymentLabel[c.payment_type] ?? c.payment_type,
      cashCollected,
      toBePaid,
      c.total_amount,   // backend rev = contract value
      c.plan_months ?? 1,
      c.closer_id ? (setterMap[c.closer_id] ?? '') : '',
      fmtDate(c.started_at),
      c.active ? 'Active' : 'Inactive',
      c.notes,
    ]
  })

  await write(sheets, spreadsheetId, title, [headers, ...dataRows])

  const requests: sheets_v4.Schema$Request[] = [
    headerFmt(sheetId, headers.length, C.darkGray),
    freezeRow(sheetId),
    autoFilter(sheetId, headers.length),
    colW(sheetId, 0, 160), colW(sheetId, 1, 120), colW(sheetId, 2, 100),
    colW(sheetId, 3, 110), colW(sheetId, 4, 130), colW(sheetId, 5, 120),
    colW(sheetId, 6, 100), colW(sheetId, 7, 110), colW(sheetId, 8, 130),
    colW(sheetId, 9, 110), colW(sheetId, 10, 100), colW(sheetId, 11, 80),
    colW(sheetId, 12, 220),
  ]

  dataRows.forEach((row, i) => {
    const rowIdx = i + 1
    const client = clients[i]
    const payType = client.payment_type

    // Alternating bg
    if (i % 2 === 1) requests.push(rangeBg(sheetId, rowIdx, 0, rowIdx + 1, headers.length, C.lightGray))

    // Payment type badge color
    if (payType === 'pif') requests.push(cellBg(sheetId, rowIdx, 4, C.lightGreen))
    else if (payType === 'plan') requests.push(cellBg(sheetId, rowIdx, 4, C.lightBlue))
    else requests.push(cellBg(sheetId, rowIdx, 4, C.lightAmber))

    // Active badge
    if (client.active) requests.push(cellBg(sheetId, rowIdx, 11, C.lightGreen))
    else requests.push(cellBg(sheetId, rowIdx, 11, C.medGray))

    // Offer type — dark badge
    requests.push(cellFmt(sheetId, rowIdx, 1, rowIdx + 1, 2, {
      backgroundColor: C.darkGray,
      textFormat: { bold: true, foregroundColor: C.white, fontSize: 9 },
      horizontalAlignment: 'CENTER',
    }))

    // Currency columns — right align
    for (const c of [2, 5, 6, 7]) {
      requests.push(cellFmt(sheetId, rowIdx, c, rowIdx + 1, c + 1, { horizontalAlignment: 'RIGHT' }))
    }
  })

  await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests } })
}

// ─── 3. Freebies Sent sheet ───────────────────────────────────────────────────

async function buildFreebiesSheet(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
  leads: Lead[]
) {
  const title = 'Freebies Sent'
  const sheetId = await getOrCreateSheet(sheets, spreadsheetId, title, C.midGreen)
  await clearSheet(sheets, spreadsheetId, title)

  const sent = leads.filter(l => l.freebie_sent_at)
  const headers = ['IG Handle', 'Full Name', 'Phone', 'Date Sent', 'Source', 'Tier', 'Stage', 'Notes']

  const rows = sent.map(l => [
    l.ig_username, l.full_name, l.phone, fmtDate(l.freebie_sent_at),
    l.source, l.tier ? `Tier ${l.tier}` : '', STAGE_LABEL[l.stage] ?? l.stage, l.setter_notes,
  ])

  await write(sheets, spreadsheetId, title, [headers, ...rows])

  const requests: sheets_v4.Schema$Request[] = [
    headerFmt(sheetId, headers.length, C.midGreen),
    freezeRow(sheetId),
    autoFilter(sheetId, headers.length),
    colW(sheetId, 0, 160), colW(sheetId, 1, 150), colW(sheetId, 2, 130),
    colW(sheetId, 3, 110), colW(sheetId, 4, 130), colW(sheetId, 5, 80),
    colW(sheetId, 6, 120), colW(sheetId, 7, 220),
  ]

  rows.forEach((_, i) => {
    if (i % 2 === 1) requests.push(rangeBg(sheetId, i + 1, 0, i + 2, headers.length, C.lightGreen))
  })

  await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests } })
}

// ─── 4. KPI Dashboard sheet ───────────────────────────────────────────────────

async function buildKpiDashboard(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
  snapshots: MonthlySnapshot[],
  clients: Client[],
  installments: PaymentInstallment[],
  currency: string,
  liveSnap: MonthlySnapshot | null,
  expenses: Expense[]
) {
  const title = 'KPI Dashboard'
  const sheetId = await getOrCreateSheet(sheets, spreadsheetId, title, C.darkBlue)
  await clearSheet(sheets, spreadsheetId, title)

  // Use live snapshot for current month if no stored snapshot, else use latest stored
  const currentMonth = new Date().toISOString().slice(0, 7)
  const stored = snapshots.sort((a, b) => b.month.localeCompare(a.month))
  const latest = stored.find(s => s.month === currentMonth) ?? liveSnap ?? stored[0]

  const fmt = (n: number) => new Intl.NumberFormat('en', { style: 'currency', currency, maximumFractionDigits: 0 }).format(n)

  const totalRevenue = clients.filter(c => c.active).reduce((s, c) => s + c.total_amount, 0)
  const totalCashCollected = installments.filter(i => i.paid).reduce((s, i) => s + i.amount, 0)
    + clients.filter(c => c.payment_type === 'pif' && c.active).reduce((s, c) => s + c.total_amount, 0)
  const toBePaid = totalRevenue - totalCashCollected
  const avgCash = clients.length > 0 ? totalCashCollected / clients.length : 0
  const avgSales = clients.length > 0 ? totalRevenue / clients.length : 0
  const ltvMonths = clients.filter(c => c.plan_months).reduce((s, c) => s + (c.plan_months ?? 0), 0)
    / (clients.filter(c => c.plan_months).length || 1)

  const showUpRate = latest?.show_up_rate ?? 0
  const closeRate = latest?.close_rate ?? 0
  const noShowRate = latest?.no_show_rate ?? 0
  const cancelRate = latest?.cancellation_rate ?? 0
  const meetings = latest?.meetings_booked ?? 0
  const closedDeals = latest?.clients_signed ?? 0

  const offerSentRate = meetings > 0 ? (closedDeals / meetings) * 100 : 0
  const bookingRate = (latest?.new_followers ?? 0) > 0
    ? (meetings / (latest?.new_followers ?? 1)) * 100 : 0

  // ── Expenses summary for current month ───────────────────────────────────
  const EXPENSE_CATEGORIES: { key: Expense['category']; label: string }[] = [
    { key: 'team',       label: 'Team' },
    { key: 'software',   label: 'Software' },
    { key: 'ads',        label: 'Ads' },
    { key: 'withdrawal', label: 'Withdrawals' },
    { key: 'other',      label: 'Other' },
  ]
  const currentMonthExpenses = expenses.filter(e => e.month === currentMonth)
  const expenseByCategory = EXPENSE_CATEGORIES.map(c => ({
    label: c.label,
    total: currentMonthExpenses.filter(e => e.category === c.key).reduce((s, e) => s + e.amount, 0),
  }))
  const totalExpenses = expenseByCategory.reduce((s, c) => s + c.total, 0)
  const netProfit = totalCashCollected - totalExpenses

  // Build rows
  const rows: (string | number | null)[][] = [
    // Row 0: spacer
    [null],
    // Row 1: section headers
    ['SALES', null, null, null, 'APPOINTMENT SETTING', null, null, null, 'CLOSING', null, null, null, null],
    // Row 2: KPIs / Target KPIs
    [null, null, null, null, 'KPIs', null, 'TARGET KPIs', null, 'KPIs', null, null, 'TARGET KPIs', null],
    // Row 3
    ['SALES (CLOSED DEALS)', fmt(totalRevenue), null, null, 'RESPONSE RATE', pct(0), null, null, 'SHOW UP RATE', pct(showUpRate), null, null, null],
    // Row 4
    ['CASH COLLECTED', fmt(totalCashCollected), null, null, 'OFFER SENT', pct(offerSentRate), null, null, 'CLOSING RATE', pct(closeRate), null, null, null],
    // Row 5
    ['TO BE PAID', fmt(toBePaid), null, null, 'BOOKING RATE', pct(bookingRate), null, null, 'NO SHOWS %', pct(noShowRate), null, null, null],
    // Row 6
    ['BACKEND REV', fmt(totalRevenue), null, null, 'OFFER TO BOOKING RATE', pct(offerSentRate > 0 ? (bookingRate / offerSentRate) * 100 : 0), null, null, 'CANCELED %', pct(cancelRate), null, null, null],
    // Row 7
    ['CLIENT LTV (months)', ltvMonths.toFixed(1), null, null, null, null, null, null, 'TOTAL SALES', closedDeals, null, null, null],
    // Row 8
    ['AVG CASH COLLECTED', fmt(avgCash), null, null, null, null, null, null, null, null, null, null, null],
    // Row 9
    ['AVG SALES AMOUNT', fmt(avgSales), null, null, null, null, null, null, null, null, null, null, null],
    // Row 10: spacer
    [null],
    // Row 11: ADS section header
    ['ADS PERFORMANCE', null, null, null, null, null, null, null, null, null, null, null, null],
    // Row 12: sub-header
    ['VARIABLE', 'VALUE', null, null, null, null, null, null, null, null, null, null, null],
    // Row 13-20: current month live metrics
    ['NEW FOLLOWERS', latest?.new_followers ?? 0],
    ['MEETINGS BOOKED', latest?.meetings_booked ?? 0],
    ['CALLS HELD', latest?.calls_held ?? 0],
    ['CLIENTS SIGNED', latest?.clients_signed ?? 0],
    ['CLOSE RATE', pct(closeRate)],
    ['SHOW UP RATE', pct(showUpRate)],
    ['CASH COLLECTED', fmt(totalCashCollected)],
    ['REVENUE', fmt(totalRevenue)],
    // Spacer before expenses
    [null],
    // Monthly Expenses section header
    ['MONTHLY EXPENSES', null, null, null, null, null, null, null, null, null, null, null, null],
    // Expenses sub-header
    ['CATEGORY', 'AMOUNT', null, null, null, null, null, null, null, null, null, null, null],
    // Per-category rows
    ...expenseByCategory.map(c => [c.label, fmt(c.total)]),
    // Net Profit row
    ['NET PROFIT', fmt(netProfit)],
  ]

  await write(sheets, spreadsheetId, title, rows)

  const numCols = 13
  const requests: sheets_v4.Schema$Request[] = [
    // Full black background
    rangeBg(sheetId, 0, 0, rows.length + 5, numCols + 2, C.black),

    // Section title headers — dark gray
    rangeBg(sheetId, 1, 0, 2, 4, C.darkGray),
    rangeBg(sheetId, 1, 4, 2, 8, C.darkGray),
    rangeBg(sheetId, 1, 8, 2, 13, C.darkGray),

    // Section title text formatting
    cellFmt(sheetId, 1, 0, 2, 4, { textFormat: { bold: true, foregroundColor: C.white, fontSize: 13 }, horizontalAlignment: 'CENTER', verticalAlignment: 'MIDDLE' }),
    cellFmt(sheetId, 1, 4, 2, 8, { textFormat: { bold: true, foregroundColor: C.white, fontSize: 13 }, horizontalAlignment: 'CENTER', verticalAlignment: 'MIDDLE' }),
    cellFmt(sheetId, 1, 8, 2, 13, { textFormat: { bold: true, foregroundColor: C.white, fontSize: 13 }, horizontalAlignment: 'CENTER', verticalAlignment: 'MIDDLE' }),

    // KPIs sub-header — blue
    rangeBg(sheetId, 2, 0, 3, 2, C.midBlue),
    rangeBg(sheetId, 2, 4, 3, 6, C.midBlue),
    rangeBg(sheetId, 2, 8, 3, 11, C.midBlue),
    cellFmt(sheetId, 2, 0, 3, 2, { textFormat: { bold: true, foregroundColor: C.white, fontSize: 10 }, horizontalAlignment: 'CENTER' }),
    cellFmt(sheetId, 2, 4, 3, 6, { textFormat: { bold: true, foregroundColor: C.white, fontSize: 10 }, horizontalAlignment: 'CENTER' }),
    cellFmt(sheetId, 2, 8, 3, 11, { textFormat: { bold: true, foregroundColor: C.white, fontSize: 10 }, horizontalAlignment: 'CENTER' }),

    // TARGET KPIs sub-header — red
    rangeBg(sheetId, 2, 6, 3, 8, C.midRed),
    rangeBg(sheetId, 2, 11, 3, 13, C.midRed),
    cellFmt(sheetId, 2, 6, 3, 8, { textFormat: { bold: true, foregroundColor: C.white, fontSize: 10 }, horizontalAlignment: 'CENTER' }),
    cellFmt(sheetId, 2, 11, 3, 13, { textFormat: { bold: true, foregroundColor: C.white, fontSize: 10 }, horizontalAlignment: 'CENTER' }),

    // Sales KPI rows text
    cellFmt(sheetId, 3, 0, 10, 1, { textFormat: { foregroundColor: C.white, fontSize: 10 }, verticalAlignment: 'MIDDLE' }),
    cellFmt(sheetId, 3, 1, 10, 2, { textFormat: { bold: true, foregroundColor: C.white, fontSize: 10 }, horizontalAlignment: 'RIGHT', verticalAlignment: 'MIDDLE' }),
    // Highlight Cash Collected in Sales
    cellFmt(sheetId, 4, 0, 5, 2, { textFormat: { bold: true, foregroundColor: C.amber, fontSize: 10 } }),

    // Appt Setting KPI rows text
    cellFmt(sheetId, 3, 4, 10, 6, { textFormat: { foregroundColor: C.white, fontSize: 10 }, verticalAlignment: 'MIDDLE' }),
    cellFmt(sheetId, 3, 5, 10, 6, { textFormat: { bold: true, foregroundColor: C.white, fontSize: 10 }, horizontalAlignment: 'RIGHT' }),

    // Closing KPI rows text
    cellFmt(sheetId, 3, 8, 10, 11, { textFormat: { foregroundColor: C.white, fontSize: 10 }, verticalAlignment: 'MIDDLE' }),
    cellFmt(sheetId, 3, 9, 10, 11, { textFormat: { bold: true, foregroundColor: C.white, fontSize: 10 }, horizontalAlignment: 'RIGHT' }),

    // ADS section header
    rangeBg(sheetId, 11, 0, 12, 2, C.darkGray),
    cellFmt(sheetId, 11, 0, 12, 2, { textFormat: { bold: true, foregroundColor: C.white, fontSize: 12 }, horizontalAlignment: 'CENTER' }),
    rangeBg(sheetId, 12, 0, 13, 1, C.midBlue),
    rangeBg(sheetId, 12, 1, 13, 2, C.midBlue),
    cellFmt(sheetId, 12, 0, 13, 2, { textFormat: { bold: true, foregroundColor: C.white, fontSize: 10 }, horizontalAlignment: 'CENTER' }),

    // ADS data rows text (rows 13–20, 8 rows)
    cellFmt(sheetId, 13, 0, 21, 1, { textFormat: { foregroundColor: C.white, fontSize: 10 } }),
    cellFmt(sheetId, 13, 1, 21, 2, { textFormat: { bold: true, foregroundColor: C.white, fontSize: 10 }, horizontalAlignment: 'RIGHT' }),

    // ── Monthly Expenses section (rows 22+) ───────────────────────────────
    // Section header (row 22)
    rangeBg(sheetId, 22, 0, 23, 2, C.darkRed),
    cellFmt(sheetId, 22, 0, 23, 2, { textFormat: { bold: true, foregroundColor: C.white, fontSize: 12 }, horizontalAlignment: 'CENTER' }),
    merge(sheetId, 22, 0, 23, 2),
    rowH(sheetId, 22, 44),

    // Sub-header (row 23)
    rangeBg(sheetId, 23, 0, 24, 1, C.midRed),
    rangeBg(sheetId, 23, 1, 24, 2, C.midRed),
    cellFmt(sheetId, 23, 0, 24, 2, { textFormat: { bold: true, foregroundColor: C.white, fontSize: 10 }, horizontalAlignment: 'CENTER' }),

    // Category rows text (rows 24–28)
    cellFmt(sheetId, 24, 0, 29, 1, { textFormat: { foregroundColor: C.white, fontSize: 10 } }),
    cellFmt(sheetId, 24, 1, 29, 2, { textFormat: { bold: true, foregroundColor: C.white, fontSize: 10 }, horizontalAlignment: 'RIGHT' }),

    // Net Profit row (row 29) — highlight green if positive, red if negative
    rangeBg(sheetId, 29, 0, 30, 2, netProfit >= 0 ? C.midGreen : C.midRed),
    cellFmt(sheetId, 29, 0, 30, 2, { textFormat: { bold: true, foregroundColor: C.white, fontSize: 11 }, horizontalAlignment: 'LEFT' }),
    cellFmt(sheetId, 29, 1, 30, 2, { textFormat: { bold: true, foregroundColor: C.white, fontSize: 11 }, horizontalAlignment: 'RIGHT' }),

    // Borders for expenses section
    borders(sheetId, 22, 0, 30, 2),

    // Merges for section titles
    merge(sheetId, 1, 0, 2, 4),
    merge(sheetId, 1, 4, 2, 8),
    merge(sheetId, 1, 8, 2, 13),
    merge(sheetId, 11, 0, 12, 2),

    // Row heights
    rowH(sheetId, 1, 50),
    rowH(sheetId, 2, 30),
    ...Array.from({ length: 7 }, (_, i) => rowH(sheetId, i + 3, 28)),
    rowH(sheetId, 11, 44),

    // Column widths
    colW(sheetId, 0, 190), colW(sheetId, 1, 130),
    colW(sheetId, 4, 180), colW(sheetId, 5, 90), colW(sheetId, 6, 110),
    colW(sheetId, 8, 160), colW(sheetId, 9, 90), colW(sheetId, 11, 120),

    // Borders on the three panels
    borders(sheetId, 1, 0, 10, 4),
    borders(sheetId, 1, 4, 10, 8),
    borders(sheetId, 1, 8, 10, 13),
    borders(sheetId, 11, 0, 21, 2),
  ]

  await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests } })
}

// ─── 5. Monthly KPIs sheet ────────────────────────────────────────────────────

async function buildMonthlyKpiSheet(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
  snapshots: MonthlySnapshot[],
  businessName: string
) {
  const title = 'Monthly KPIs'
  const sheetId = await getOrCreateSheet(sheets, spreadsheetId, title, C.darkGreen)
  await clearSheet(sheets, spreadsheetId, title)

  const sorted = [...snapshots].sort((a, b) => a.month.localeCompare(b.month))
  const months = sorted.map(s => {
    const [y, m] = s.month.split('-')
    return new Date(Number(y), Number(m) - 1).toLocaleString('default', { month: 'short', year: '2-digit' })
  })

  const metrics: { label: string; key: keyof MonthlySnapshot }[] = [
    { label: 'Cash collected', key: 'cash_collected' },
    { label: 'Revenue contracted', key: 'revenue_contracted' },
    { label: 'New clients', key: 'clients_signed' },
    { label: 'Meetings booked', key: 'meetings_booked' },
    { label: 'Calls held', key: 'calls_held' },
    { label: 'New followers', key: 'new_followers' },
    { label: 'Close rate (%)', key: 'close_rate' },
    { label: 'Show-up rate (%)', key: 'show_up_rate' },
    { label: 'No-show rate (%)', key: 'no_show_rate' },
    { label: 'Cancellation rate (%)', key: 'cancellation_rate' },
  ]

  const headerRow = [businessName, ...months]
  const dataRows = metrics.map(m => [
    m.label, ...sorted.map(s => { const v = s[m.key]; return typeof v === 'number' ? v : '' }),
  ])

  await write(sheets, spreadsheetId, title, [headerRow, ...dataRows])

  const numCols = headerRow.length
  const requests: sheets_v4.Schema$Request[] = [
    // Business name cell
    cellFmt(sheetId, 0, 0, 1, 1, {
      backgroundColor: C.darkGreen,
      textFormat: { bold: true, foregroundColor: C.white, fontSize: 14 },
      horizontalAlignment: 'CENTER', verticalAlignment: 'MIDDLE',
    }),
    // Month headers
    rangeBg(sheetId, 0, 1, 1, numCols, C.midGreen),
    cellFmt(sheetId, 0, 1, 1, numCols, { textFormat: { bold: true, foregroundColor: C.white, fontSize: 10 }, horizontalAlignment: 'CENTER' }),
    freezeRow(sheetId),
    // Label column
    rangeBg(sheetId, 1, 0, dataRows.length + 1, 1, C.lightGreen),
    cellFmt(sheetId, 1, 0, dataRows.length + 1, 1, { textFormat: { bold: true, fontSize: 10 } }),
    rowH(sheetId, 0, 40),
    colW(sheetId, 0, 170),
    ...months.map((_, i) => colW(sheetId, i + 1, 100)),
  ]

  dataRows.forEach((_, i) => {
    if (i % 2 === 1) requests.push(rangeBg(sheetId, i + 1, 1, i + 2, numCols, C.lightGray))
  })

  await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests } })
}

// ─── 6. Annual Overview sheet ─────────────────────────────────────────────────

async function buildAnnualOverview(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
  snapshots: MonthlySnapshot[]
) {
  const title = 'Annual Overview'
  const sheetId = await getOrCreateSheet(sheets, spreadsheetId, title, C.midGray)
  await clearSheet(sheets, spreadsheetId, title)

  const currentYear = new Date().getFullYear()
  const yearSnaps = snapshots.filter(s => s.month.startsWith(String(currentYear)))
  const monthMap = Object.fromEntries(yearSnaps.map(s => [s.month, s]))

  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

  function snapForMonth(i: number): MonthlySnapshot | undefined {
    return monthMap[`${currentYear}-${String(i + 1).padStart(2, '0')}`]
  }

  const rows: (string | number | null)[][] = [
    // Row 0: title
    [null, null, null, null, null, null, null, null, null, null, `ANNUAL OVERVIEW ${currentYear}`],
    // Row 1: spacer
    [null],
    // Row 2: H1 headers
    ['Financial Overview', 'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', null],
    // Row 3-6: H1 data
    ['REVENUE', ...MONTHS.slice(0, 6).map((_, i) => snapForMonth(i)?.revenue_contracted ?? 0)],
    ['EXPENSES', ...MONTHS.slice(0, 6).map(() => 0)],  // user fills in
    ['CASH FLOW', ...MONTHS.slice(0, 6).map((_, i) => snapForMonth(i)?.cash_collected ?? 0)],
    ['TOTAL BOTTOM LINE', ...MONTHS.slice(0, 6).map((_, i) => (snapForMonth(i)?.cash_collected ?? 0))],
    // Row 7: spacer
    [null],
    // Row 8: H2 headers
    ['Financial Overview', 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER', null],
    // Row 9-12: H2 data
    ['REVENUE', ...MONTHS.slice(6, 12).map((_, i) => snapForMonth(i + 6)?.revenue_contracted ?? 0)],
    ['EXPENSES', ...MONTHS.slice(6, 12).map(() => 0)],
    ['CASH FLOW', ...MONTHS.slice(6, 12).map((_, i) => snapForMonth(i + 6)?.cash_collected ?? 0)],
    ['TOTAL BOTTOM LINE', ...MONTHS.slice(6, 12).map((_, i) => (snapForMonth(i + 6)?.cash_collected ?? 0))],
    // Row 13: spacer
    [null],
    // Row 14: goals row
    ['SET YOUR GOALS', null, null, 'REVENUE TARGET', null, null, 'EXPENSES TARGET', null, null, 'BOTTOM LINE TARGET', null],
    // Row 15: spacer
    [null],
    // Row 16: yearly totals header
    ['YEARLY TOTALS', null],
    // Row 17-21: totals
    ['REVENUE', yearSnaps.reduce((s, n) => s + (n.revenue_contracted ?? 0), 0)],
    ['EXPENSES', 0],
    ['CASHFLOW', yearSnaps.reduce((s, n) => s + (n.cash_collected ?? 0), 0)],
    ['PAYOUTS', 0],
    ['TOTAL BOTTOM LINE', yearSnaps.reduce((s, n) => s + (n.cash_collected ?? 0), 0)],
  ]

  await write(sheets, spreadsheetId, title, rows)

  const numCols = 11
  const requests: sheets_v4.Schema$Request[] = [
    // Full dark background
    rangeBg(sheetId, 0, 0, rows.length + 5, numCols + 2, C.black),

    // Title
    cellFmt(sheetId, 0, 10, 1, 11, { textFormat: { bold: true, foregroundColor: C.white, fontSize: 16 }, horizontalAlignment: 'RIGHT', verticalAlignment: 'MIDDLE' }),
    rowH(sheetId, 0, 50),

    // H1 header row
    rangeBg(sheetId, 2, 0, 3, 8, C.darkGray),
    cellFmt(sheetId, 2, 0, 3, 8, { textFormat: { bold: true, foregroundColor: C.white, fontSize: 10 }, horizontalAlignment: 'CENTER', verticalAlignment: 'MIDDLE' }),

    // H1 data rows
    rangeBg(sheetId, 3, 0, 7, 1, C.midGray),
    cellFmt(sheetId, 3, 0, 7, 1, { textFormat: { foregroundColor: C.white, fontSize: 10 } }),
    cellFmt(sheetId, 3, 1, 7, 8, { textFormat: { foregroundColor: C.white, fontSize: 10 }, horizontalAlignment: 'RIGHT' }),

    // H2 header row
    rangeBg(sheetId, 8, 0, 9, 8, C.darkGray),
    cellFmt(sheetId, 8, 0, 9, 8, { textFormat: { bold: true, foregroundColor: C.white, fontSize: 10 }, horizontalAlignment: 'CENTER', verticalAlignment: 'MIDDLE' }),

    // H2 data rows
    rangeBg(sheetId, 9, 0, 13, 1, C.midGray),
    cellFmt(sheetId, 9, 0, 13, 1, { textFormat: { foregroundColor: C.white, fontSize: 10 } }),
    cellFmt(sheetId, 9, 1, 13, 8, { textFormat: { foregroundColor: C.white, fontSize: 10 }, horizontalAlignment: 'RIGHT' }),

    // Goals row
    rangeBg(sheetId, 14, 0, 15, 11, C.darkGray),
    cellFmt(sheetId, 14, 0, 15, 11, { textFormat: { bold: true, foregroundColor: C.white, fontSize: 10 }, horizontalAlignment: 'CENTER' }),

    // Yearly totals header
    rangeBg(sheetId, 16, 0, 17, 2, C.darkGray),
    cellFmt(sheetId, 16, 0, 17, 2, { textFormat: { bold: true, foregroundColor: C.white, fontSize: 12 }, horizontalAlignment: 'CENTER' }),

    // Revenue row — blue
    rangeBg(sheetId, 17, 0, 18, 2, C.midBlue),
    cellFmt(sheetId, 17, 0, 18, 2, { textFormat: { bold: true, foregroundColor: C.white, fontSize: 11 } }),

    // Expenses row — red
    rangeBg(sheetId, 18, 0, 19, 2, C.midRed),
    cellFmt(sheetId, 18, 0, 19, 2, { textFormat: { bold: true, foregroundColor: C.white, fontSize: 11 } }),

    // Other total rows
    cellFmt(sheetId, 19, 0, 22, 1, { textFormat: { foregroundColor: C.white, fontSize: 10 } }),
    cellFmt(sheetId, 19, 1, 22, 2, { textFormat: { bold: true, foregroundColor: C.white, fontSize: 10 }, horizontalAlignment: 'RIGHT' }),

    // Borders
    borders(sheetId, 2, 0, 7, 8),
    borders(sheetId, 8, 0, 13, 8),
    borders(sheetId, 16, 0, 22, 2),

    // Merges
    merge(sheetId, 16, 0, 17, 2),

    // Column widths
    colW(sheetId, 0, 160),
    ...Array.from({ length: 7 }, (_, i) => colW(sheetId, i + 1, 110)),
  ]

  await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests } })
}

// ─── 7. Ad Spend sheet ────────────────────────────────────────────────────────

async function buildAdSpendSheet(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
  adSpend: AdSpendLog[],
  snapshots: MonthlySnapshot[]
) {
  const title = 'Ad Spend'
  const sheetId = await getOrCreateSheet(sheets, spreadsheetId, title, C.darkGray)
  await clearSheet(sheets, spreadsheetId, title)

  const sorted = [...adSpend].sort((a, b) => b.month.localeCompare(a.month))
  const headers = ['Month', 'Currency', 'Estimated', 'Actual', 'Confirmed', 'ROAS (Cash)', 'ROAS (Revenue)', 'ROAS (Profit)']

  // Build a cash/revenue map per month from snapshots
  const snapMap = Object.fromEntries(snapshots.map(s => [s.month, s]))

  const rows = sorted.map(a => {
    const spend = a.actual_amount || a.estimated_amount || 0
    const snap = snapMap[a.month]
    const cash = snap?.cash_collected ?? 0
    const revenue = snap?.revenue_contracted ?? 0
    const profit = cash - spend
    return [
      a.month, a.currency_code, a.estimated_amount, a.actual_amount, a.confirmed ? '✓' : '',
      spend > 0 ? parseFloat((cash / spend).toFixed(2)) : '',
      spend > 0 ? parseFloat((revenue / spend).toFixed(2)) : '',
      spend > 0 ? parseFloat((profit / spend).toFixed(2)) : '',
    ]
  })

  await write(sheets, spreadsheetId, title, [headers, ...rows])

  const requests: sheets_v4.Schema$Request[] = [
    headerFmt(sheetId, headers.length, C.darkGray),
    freezeRow(sheetId),
    colW(sheetId, 0, 100), colW(sheetId, 1, 90),
    colW(sheetId, 2, 120), colW(sheetId, 3, 110), colW(sheetId, 4, 90),
    colW(sheetId, 5, 110), colW(sheetId, 6, 120), colW(sheetId, 7, 110),
  ]

  rows.forEach((_, i) => {
    const rowIdx = i + 1
    if (adSpend[i].confirmed) requests.push(cellBg(sheetId, rowIdx, 4, C.lightGreen))
    if (i % 2 === 1) requests.push(rangeBg(sheetId, rowIdx, 0, rowIdx + 1, headers.length, C.lightGray))
    // ROAS color: green if > 1, red if < 1
    for (const col of [5, 6, 7]) {
      const val = rows[i][col]
      if (typeof val === 'number') {
        requests.push(cellBg(sheetId, rowIdx, col, val >= 1 ? C.lightGreen : C.lightRed))
      }
    }
  })

  await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests } })
}

// ─── Main sync ────────────────────────────────────────────────────────────────

export async function syncToSheets(userId: string): Promise<{ spreadsheetId: string; spreadsheetUrl: string }> {
  const auth = await getAuthClientForUser(userId)
  if (!auth) throw new Error('Not connected to Google')

  const supabase = await createServerSupabaseClient()
  const sheets = google.sheets({ version: 'v4', auth })
  const drive = google.drive({ version: 'v3', auth })

  // Get or create spreadsheet
  const { data: integration } = await supabase
    .from('google_integrations')
    .select('spreadsheet_id')
    .eq('user_id', userId)
    .single()

  let spreadsheetId = integration?.spreadsheet_id
  let spreadsheetUrl: string

  const { data: userProfile } = await supabase
    .from('users').select('business_name, base_currency').eq('id', userId).single()
  const businessName = userProfile?.business_name ?? 'DrivnDashboardr'
  const currency = userProfile?.base_currency ?? 'USD'

  if (!spreadsheetId) {
    const file = await drive.files.create({
      requestBody: { name: `${businessName} — CRM Data`, mimeType: 'application/vnd.google-apps.spreadsheet' },
      fields: 'id,webViewLink',
    })
    spreadsheetId = file.data.id!
    spreadsheetUrl = file.data.webViewLink!
  } else {
    const file = await drive.files.get({ fileId: spreadsheetId, fields: 'webViewLink' })
    spreadsheetUrl = file.data.webViewLink!
  }

  // Fetch all data — clients first so we can query their installments
  const currentMonth = new Date().toISOString().slice(0, 7)
  const monthStart = `${currentMonth}-01`

  const [
    { data: leadsData }, { data: clientsData }, { data: settersData },
    { data: adSpendData }, { data: snapshotsData },
    { data: newLeadsThisMonth }, { data: bookedLeadsThisMonth }, { data: monthInstallments },
    { data: expensesData },
  ] = await Promise.all([
    supabase.from('leads').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
    supabase.from('clients').select('*').eq('user_id', userId).order('started_at', { ascending: false }),
    supabase.from('setters').select('*').eq('user_id', userId).eq('active', true),
    supabase.from('ad_spend_log').select('*').eq('user_id', userId).order('month', { ascending: false }),
    supabase.from('monthly_snapshots').select('*').eq('user_id', userId).order('month', { ascending: false }),
    supabase.from('leads').select('id').eq('user_id', userId).gte('created_at', monthStart),
    supabase.from('leads').select('call_booked_at, call_outcome').eq('user_id', userId)
      .or(`call_booked_at.gte.${monthStart},and(call_outcome.not.is.null,updated_at.gte.${monthStart})`),
    supabase.from('payment_installments').select('amount').eq('paid', true).gte('paid_at', monthStart),
    supabase.from('expenses').select('*').eq('user_id', userId).eq('month', currentMonth),
  ])

  const leads = (leadsData ?? []) as Lead[]
  const clients = (clientsData ?? []) as Client[]
  const setters = (settersData ?? []) as Setter[]
  const adSpend = (adSpendData ?? []) as AdSpendLog[]
  const snapshots = (snapshotsData ?? []) as MonthlySnapshot[]
  const expenses = (expensesData ?? []) as Expense[]

  // Fetch installments now that we have client IDs
  const clientIds = clients.map(c => c.id)
  const { data: installmentsData } = clientIds.length > 0
    ? await supabase.from('payment_installments').select('*').in('client_id', clientIds)
    : { data: [] }
  const installments = (installmentsData ?? []) as PaymentInstallment[]

  // Build live current-month snapshot for the KPI Dashboard
  const monthClients = clients.filter(c => c.started_at >= monthStart)
  const cashFromNewClients = monthClients.filter(c => c.payment_type !== 'plan').reduce((s, c) => s + c.total_amount, 0)
  const cashFromInst = (monthInstallments ?? []).reduce((s, i) => s + (i as { amount: number }).amount, 0)
  const bookedThisMonth = (bookedLeadsThisMonth ?? []).filter((l: { call_booked_at: string | null }) => l.call_booked_at && l.call_booked_at >= monthStart)
  const outcomesThisMonth = (bookedLeadsThisMonth ?? []).filter((l: { call_outcome: string | null }) => l.call_outcome)
  const showed = outcomesThisMonth.filter((l: { call_outcome: string }) => l.call_outcome === 'showed').length
  const totalOut = outcomesThisMonth.length

  const liveSnap: MonthlySnapshot = {
    id: 'live', user_id: userId, month: currentMonth,
    cash_collected: cashFromNewClients + cashFromInst,
    revenue_contracted: monthClients.reduce((s, c) => s + c.total_amount, 0),
    new_followers: (newLeadsThisMonth ?? []).length,
    meetings_booked: bookedThisMonth.length,
    calls_held: showed,
    clients_signed: monthClients.length,
    close_rate: bookedThisMonth.length > 0 ? (monthClients.length / bookedThisMonth.length) * 100 : 0,
    show_up_rate: totalOut > 0 ? (showed / totalOut) * 100 : 0,
    no_show_rate: totalOut > 0 ? (outcomesThisMonth.filter((l: { call_outcome: string }) => l.call_outcome === 'no_show').length / totalOut) * 100 : 0,
    cancellation_rate: totalOut > 0 ? (outcomesThisMonth.filter((l: { call_outcome: string }) => l.call_outcome === 'canceled').length / totalOut) * 100 : 0,
    created_at: new Date().toISOString(),
  }

  // Build sheets sequentially to avoid rate limits
  await buildKpiDashboard(sheets, spreadsheetId, snapshots, clients, installments, currency, liveSnap, expenses)
  await buildPipelineSheet(sheets, spreadsheetId, leads, setters)
  await buildClientsSheet(sheets, spreadsheetId, clients, installments, setters)
  await buildFreebiesSheet(sheets, spreadsheetId, leads)
  await buildMonthlyKpiSheet(sheets, spreadsheetId, snapshots, businessName)
  await buildAnnualOverview(sheets, spreadsheetId, snapshots)
  await buildAdSpendSheet(sheets, spreadsheetId, adSpend, snapshots)

  // Persist
  await supabase.from('google_integrations').update({
    spreadsheet_id: spreadsheetId,
    spreadsheet_url: spreadsheetUrl,
    last_synced_at: new Date().toISOString(),
  }).eq('user_id', userId)

  return { spreadsheetId, spreadsheetUrl }
}
