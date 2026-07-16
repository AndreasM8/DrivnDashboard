import type { ParsedColumn, ParsedRow } from '@/app/api/import/parse/route'

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
      leads_count: null,
      calls_booked: null,
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
