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

  let headers: string[]
  let sampleRows: Record<string, string>[]
  try {
    const body = await req.json() as { headers?: string[]; sampleRows?: Record<string, string>[] }
    headers    = body.headers    ?? []
    sampleRows = body.sampleRows ?? []
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (headers.length === 0) {
    return NextResponse.json({ error: 'No column headers found in CSV' }, { status: 400 })
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY ?? '' })

  const prompt = `You are mapping columns from a fitness coach's CSV spreadsheet.

Map each column header to one of these field types:
- date: a date or month column
- revenue: money received / cash collected
- leads_count: number of leads, DMs, people contacted
- calls_booked: calls or meetings booked
- close_rate: close rate or conversion rate (%)
- ad_spend: advertising spend / ad cost
- contracts_signed: contracts or clients signed
- followers_gained: new followers gained
- ignore: anything else (totals, notes, cumulative counts, etc.)

Headers: ${JSON.stringify(headers)}

Sample rows:
${JSON.stringify(sampleRows.slice(0, 5), null, 2)}

Return ONLY a JSON array, no explanation:
[{"originalName":"<header>","mappedTo":"<field>","hasData":<bool>}]`

  let rawJson: string
  try {
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    })
    const textBlock = message.content.find(b => b.type === 'text')
    rawJson = textBlock ? textBlock.text : ''
  } catch (err) {
    console.error('[import/parse] Anthropic error:', err)
    return NextResponse.json({ error: 'Failed to get column mapping from AI' }, { status: 500 })
  }

  const cleaned = rawJson.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim()

  let columns: ParsedColumn[]
  try {
    columns = JSON.parse(cleaned) as ParsedColumn[]
  } catch {
    console.error('[import/parse] JSON parse failed:', cleaned.slice(0, 300))
    return NextResponse.json({ error: 'AI returned invalid column mapping' }, { status: 500 })
  }

  return NextResponse.json({ columns })
}
