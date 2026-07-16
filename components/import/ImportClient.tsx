'use client'

import { useState } from 'react'
import CsvUploader from './CsvUploader'
import DataPreview from './DataPreview'
import {
  parseCsv, applyColumnMapping, parseDateValue,
  parseFollowersSheet, parseMeetingsSheet, parseSalesSheet,
} from '@/lib/csv-parser'
import type { ParseResult, ParsedRow, ParsedColumn } from '@/app/api/import/parse/route'

type ImportState  = 'select-type' | 'idle' | 'previewing' | 'importing' | 'done'
type ImportType   = 'followers' | 'meetings' | 'sales' | 'custom'

const TYPE_OPTIONS: { key: ImportType; label: string; sub: string; icon: string }[] = [
  { key: 'followers', label: 'New followers',     sub: 'One row per follower, date column',          icon: '👥' },
  { key: 'meetings',  label: 'Meetings & calls',  sub: 'Sales pipeline, calls + show-up tracking',  icon: '📅' },
  { key: 'sales',     label: 'Sales & revenue',   sub: 'Clients overview, deal sizes & cash',       icon: '💰' },
  { key: 'custom',    label: 'Monthly summary',   sub: 'Pre-aggregated CSV — Claude maps columns',  icon: '📊' },
]

export default function ImportClient() {
  const [state,          setState]         = useState<ImportState>('select-type')
  const [importType,     setImportType]    = useState<ImportType | null>(null)
  const [parsing,        setParsing]       = useState(false)
  const [parseResult,    setParseResult]   = useState<ParseResult | null>(null)
  const [importedMonths, setImportedMonths] = useState(0)
  const [error,          setError]         = useState<string | null>(null)
  const [pendingCsv,     setPendingCsv]    = useState('')

  function selectType(t: ImportType) {
    setImportType(t)
    setError(null)
    setState('idle')
  }

  async function parseCSV(csvText: string) {
    setError(null)
    setParsing(true)
    setPendingCsv(csvText)

    try {
      const { headers, rows } = parseCsv(csvText)
      if (headers.length === 0 || rows.length === 0) {
        throw new Error('No data found in the file. Please check it has headers and rows.')
      }

      let parsedRows: ParsedRow[]
      let columns: ParsedColumn[]
      let summary: string

      if (importType === 'followers') {
        ({ parsedRows, columns } = parseFollowersSheet(headers, rows))
        summary = `Found ${rows.length} follower records → ${parsedRows.length} month(s) of data`

      } else if (importType === 'meetings') {
        ({ parsedRows, columns } = parseMeetingsSheet(headers, rows))
        summary = `Found ${rows.length} meeting records → ${parsedRows.length} month(s) of data`

      } else if (importType === 'sales') {
        ({ parsedRows, columns } = parseSalesSheet(headers, rows))
        summary = `Found ${rows.length} client records → ${parsedRows.length} month(s) of data`

      } else {
        // Custom / monthly summary — ask Claude for column mapping
        const res = await fetch('/api/import/parse', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ headers, sampleRows: rows.slice(0, 5) }),
        })
        if (!res.ok) {
          const body = await res.json().catch(() => ({})) as { error?: string }
          throw new Error(body.error ?? `Parse failed (HTTP ${res.status})`)
        }
        ;({ columns } = await res.json() as { columns: ParsedColumn[] })
        parsedRows = applyColumnMapping(columns, rows)

        // Auto-detect per-row patterns (only dates, no numbers)
        const hasAnyNumeric = parsedRows.some(r =>
          r.revenue !== null || r.leads_count !== null || r.calls_booked !== null ||
          r.close_rate !== null || r.ad_spend !== null || r.contracts_signed !== null ||
          r.followers_gained !== null
        )
        if (!hasAnyNumeric && parsedRows.some(r => r.date !== null)) {
          const monthCounts = new Map<string, number>()
          for (const row of parsedRows) {
            if (!row.date) continue
            const m = row.date.slice(0, 7)
            monthCounts.set(m, (monthCounts.get(m) ?? 0) + 1)
          }
          parsedRows = [...monthCounts.entries()].sort().map(([m, count]) => ({
            id: crypto.randomUUID(),
            date: `${m}-01`,
            revenue: null, revenue_contracted: null, leads_count: null,
            calls_booked: null, show_up_rate: null, close_rate: null,
            ad_spend: null, contracts_signed: null, followers_gained: count,
            _originalValues: { month: m, followers_gained: String(count) },
          }))
          columns = [
            { originalName: 'date',             mappedTo: 'date'             as const, hasData: true },
            { originalName: 'followers_gained', mappedTo: 'followers_gained' as const, hasData: true },
          ]
        }

        const dates = parsedRows.map(r => r.date).filter(Boolean).sort() as string[]
        summary = dates.length > 0
          ? `Found ${parsedRows.length} rows spanning ${dates[0].slice(0,7)} to ${dates[dates.length-1].slice(0,7)}`
          : `Found ${parsedRows.length} rows`
      }

      if (parsedRows.length === 0) {
        throw new Error('Could not find any dated rows to import. Check that the date column is filled in.')
      }

      const adSpendCol    = columns.find(c => c.mappedTo === 'ad_spend')
      const dateCol       = columns.find(c => c.mappedTo === 'date')
      const adSpendHasDates = !!(adSpendCol && dateCol)
      const totalAdSpend  = adSpendHasDates ? null
        : parsedRows.reduce((s, r) => s + (r.ad_spend ?? 0), 0) || null

      setParseResult({ columns, rows: parsedRows, summary, adSpendHasDates, totalAdSpend })
      setState('previewing')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setParsing(false)
    }
  }

  async function handleConfirm(rows: ParsedRow[], adSpendDistribution: 'equal' | 'none', totalAdSpend: number | null) {
    setState('importing')
    setError(null)
    try {
      const res = await fetch('/api/import/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows, adSpendDistribution, totalAdSpend }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(body.error ?? `Import failed (HTTP ${res.status})`)
      }
      const data = await res.json() as { imported: number; months: string[] }
      setImportedMonths(data.imported)
      setState('done')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
      setState('previewing')
    }
  }

  function handleReset() {
    setState('select-type')
    setImportType(null)
    setParseResult(null)
    setError(null)
    setImportedMonths(0)
    setPendingCsv('')
  }

  // ── Done ──────────────────────────────────────────────────────────────────

  if (state === 'done') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '48px 32px', textAlign: 'center' }}>
        <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(16,185,129,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg viewBox="0 0 24 24" fill="none" width="28" height="28" stroke="var(--success)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6L9 17l-5-5" />
          </svg>
        </div>
        <div>
          <p style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-1)', margin: 0 }}>Import complete</p>
          <p style={{ fontSize: 14, color: 'var(--text-2)', margin: '6px 0 0' }}>
            {importedMonths} month{importedMonths !== 1 ? 's' : ''} of data imported successfully.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <a href="/numbers" className="btn-primary" style={{ textDecoration: 'none', display: 'inline-block' }}>View Numbers</a>
          <button onClick={handleReset} className="btn-ghost">Import more</button>
        </div>
      </div>
    )
  }

  // ── Importing spinner ──────────────────────────────────────────────────────

  if (state === 'importing') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '48px 32px', textAlign: 'center' }}>
        <div style={{ width: 36, height: 36, borderRadius: '50%', border: '2px solid var(--neon-indigo)', borderTopColor: 'transparent', animation: 'spin 0.7s linear infinite' }} />
        <p style={{ fontSize: 14, color: 'var(--text-2)', margin: 0 }}>Importing your data…</p>
      </div>
    )
  }

  // ── Preview ────────────────────────────────────────────────────────────────

  if (state === 'previewing' && parseResult) {
    return (
      <div>
        {error && <div style={{ marginBottom: 12, padding: '10px 14px', background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 'var(--radius-btn)', fontSize: 12, color: 'var(--danger)' }}>{error}</div>}
        <DataPreview parseResult={parseResult} onConfirm={handleConfirm} onReset={handleReset} />
      </div>
    )
  }

  // ── Type selector ──────────────────────────────────────────────────────────

  if (state === 'select-type') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <p style={{ fontSize: 13, color: 'var(--text-2)', margin: 0 }}>What are you importing?</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {TYPE_OPTIONS.map(opt => (
            <button
              key={opt.key}
              onClick={() => selectType(opt.key)}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
                gap: 6, padding: '14px 16px', background: 'var(--surface-2)',
                border: '1px solid var(--border)', borderRadius: 'var(--radius-card)',
                cursor: 'pointer', textAlign: 'left', transition: 'border-color 150ms',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--accent)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border)' }}
            >
              <span style={{ fontSize: 22 }}>{opt.icon}</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)' }}>{opt.label}</span>
              <span style={{ fontSize: 11, color: 'var(--text-3)', lineHeight: 1.4 }}>{opt.sub}</span>
            </button>
          ))}
        </div>
      </div>
    )
  }

  // ── Upload ─────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <button
        onClick={() => setState('select-type')}
        style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', fontSize: 12, padding: 0, width: 'fit-content' }}
      >
        <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14"><path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
        {TYPE_OPTIONS.find(o => o.key === importType)?.icon}{' '}
        {TYPE_OPTIONS.find(o => o.key === importType)?.label}
      </button>

      {error && (
        <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 'var(--radius-btn)', fontSize: 12, color: 'var(--danger)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <span>{error}</span>
          {pendingCsv && (
            <button onClick={() => parseCSV(pendingCsv)} style={{ flexShrink: 0, fontSize: 12, color: 'var(--danger)', background: 'none', border: '1px solid rgba(239,68,68,0.4)', borderRadius: 'var(--radius-btn)', padding: '3px 10px', cursor: 'pointer' }}>
              Try again
            </button>
          )}
        </div>
      )}

      <CsvUploader onFileLoaded={csv => parseCSV(csv)} loading={parsing} />
    </div>
  )
}
