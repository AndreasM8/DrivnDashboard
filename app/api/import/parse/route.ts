import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createServerSupabaseClient } from '@/lib/supabase-server'

// ─── Types ────────────────────────────────────────────────────────────────────

export type MappedField =
  | 'date'
  | 'revenue'
  | 'leads_count'
  | 'calls_booked'
  | 'close_rate'
  | 'ad_spend'
  | 'contracts_signed'
  | 'followers_gained'
  | 'ignore'

export interface ParsedColumn {
  originalName: string
  mappedTo: MappedField
  hasData: boolean
}

export interface ParsedRow {
  id: string
  date: string | null
  revenue: number | null
  leads_count: number | null
  calls_booked: number | null
  close_rate: number | null
  ad_spend: number | null
  contracts_signed: number | null
  followers_gained: number | null
  _originalValues: Record<string, string>
}

export interface ParseResult {
  columns: ParsedColumn[]
  rows: ParsedRow[]
  summary: string
  adSpendHasDates: boolean
  totalAdSpend: number | null
}

// ─── Route Handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let csvText: string
  try {
    const body = await req.json() as { csvText?: string }
    csvText = body.csvText ?? ''
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!csvText.trim()) {
    return NextResponse.json({ error: 'csvText is required' }, { status: 400 })
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY ?? '' })

  const systemPrompt = `You are parsing a CSV file from an online fitness coach's business tracking spreadsheet.

Your job:
1. Identify what each column contains based on its name and values
2. Map each column to one of: date, revenue, leads_count, calls_booked, close_rate, ad_spend, contracts_signed, followers_gained, ignore
3. Parse each row into structured data
4. For numeric fields, strip currency symbols (NOK, $, €, kr), commas, spaces
5. For dates, convert to ISO format (YYYY-MM-DD). Accept DD.MM.YYYY, DD/MM/YYYY, MM/DD/YYYY, "Jan 2025", "2025-01", etc. If only year+month given, use the first day of that month.
6. If a column has mixed data or can't be mapped, mark as 'ignore'
7. Return ONLY valid JSON matching the schema, no explanation

Return this JSON structure:
{
  "columns": [{"originalName": "...", "mappedTo": "...", "hasData": true}],
  "rows": [{"id": "uuid-placeholder-{{INDEX}}", "date": "2025-01-15" or null, "revenue": 50000 or null, "leads_count": null, "calls_booked": null, "close_rate": null, "ad_spend": null, "contracts_signed": null, "followers_gained": null, "_originalValues": {"ColName": "raw value"}}],
  "summary": "Found X rows spanning ...",
  "adSpendHasDates": true,
  "totalAdSpend": null
}

For adSpendHasDates: set to false if the CSV has ad_spend data but no date column, or if ad_spend rows all lack dates.
For totalAdSpend: if adSpendHasDates is false, sum all ad_spend values and return the total; otherwise return null.
For row ids, use the placeholder format "uuid-placeholder-0", "uuid-placeholder-1", etc. (they will be replaced client-side).`

  const userMessage = `Parse this CSV:\n\n${csvText.slice(0, 20000)}`

  let rawJson: string
  try {
    const message = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 4000,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    })

    const textBlock = message.content.find(b => b.type === 'text')
    rawJson = textBlock ? textBlock.text : ''
  } catch (err) {
    console.error('[import/parse] Anthropic error:', err)
    return NextResponse.json({ error: 'Failed to parse CSV with AI' }, { status: 500 })
  }

  // Strip markdown code fences if present
  const cleaned = rawJson.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim()

  let parsed: ParseResult
  try {
    parsed = JSON.parse(cleaned) as ParseResult
  } catch {
    console.error('[import/parse] JSON parse failed:', cleaned.slice(0, 500))
    return NextResponse.json({ error: 'AI returned invalid JSON' }, { status: 500 })
  }

  return NextResponse.json(parsed)
}
