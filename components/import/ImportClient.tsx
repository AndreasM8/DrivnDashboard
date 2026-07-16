'use client'

import { useState } from 'react'
import CsvUploader from './CsvUploader'
import DataPreview from './DataPreview'
import {
  parseCsv, applyColumnMapping,
  parseFollowersSheet, parseMeetingsSheet, parseSalesSheet,
} from '@/lib/csv-parser'
import type { ImportClientRecord, ImportLeadRecord } from '@/lib/csv-parser'
import type { ParseResult, ParsedRow, ParsedColumn } from '@/app/api/import/parse/route'

type ImportState = 'select-type' | 'idle' | 'previewing' | 'importing' | 'records' | 'done'
type ImportType  = 'followers' | 'meetings' | 'sales' | 'custom'

const TYPE_OPTIONS: { key: ImportType; label: string; sub: string; icon: string }[] = [
  { key: 'followers', label: 'New followers',    sub: 'One row per follower, date column',         icon: '👥' },
  { key: 'meetings',  label: 'Meetings & calls', sub: 'Sales pipeline, calls + show-up tracking', icon: '📅' },
  { key: 'sales',     label: 'Sales & revenue',  sub: 'Clients overview, deal sizes & cash',      icon: '💰' },
  { key: 'custom',    label: 'Monthly summary',  sub: 'Pre-aggregated CSV — Claude maps columns', icon: '📊' },
]

const PAY_LABEL: Record<string, string> = { pif: 'Paid in full', plan: 'Payment plan', split: 'Split' }

export default function ImportClient() {
  const [state,          setState]         = useState<ImportState>('select-type')
  const [importType,     setImportType]    = useState<ImportType | null>(null)
  const [parsing,        setParsing]       = useState(false)
  const [parseResult,    setParseResult]   = useState<ParseResult | null>(null)
  const [importedMonths, setImportedMonths] = useState(0)
  const [error,          setError]         = useState<string | null>(null)
  const [pendingCsv,     setPendingCsv]    = useState('')
  const [clientRecords,  setClientRecords] = useState<ImportClientRecord[]>([])
  const [leadRecords,    setLeadRecords]   = useState<ImportLeadRecord[]>([])
  const [recordsWorking, setRecordsWorking] = useState(false)
  const [recordsDone,    setRecordsDone]   = useState<{ created: number; skipped: number } | null>(null)

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
      if (headers.length === 0 || rows.length === 0)
        throw new Error('No data found in the file. Check it has headers and rows.')

      let parsedRows: ParsedRow[]
      let columns: ParsedColumn[]
      let summary: string
      let clients: ImportClientRecord[] = []
      let leads:   ImportLeadRecord[]   = []

      if (importType === 'followers') {
        const result = parseFollowersSheet(headers, rows)
        parsedRows = result.parsedRows
        columns    = result.columns
        leads      = result.leadRecords
        summary    = `Found ${rows.length} follower records → ${parsedRows.length} month(s)` +
                     (leads.length ? `, ${leads.length} leads` : '')

      } else if (importType === 'meetings') {
        const result = parseMeetingsSheet(headers, rows)
        parsedRows = result.parsedRows
        columns    = result.columns
        leads      = result.leadRecords
        summary    = `Found ${rows.length} meeting records → ${parsedRows.length} month(s)` +
                     (leads.length ? `, ${leads.length} closed deals` : '')

      } else if (importType === 'sales') {
        const result = parseSalesSheet(headers, rows)
        parsedRows = result.parsedRows
        columns    = result.columns
        clients    = result.clientRecords
        summary    = `Found ${rows.length} client records → ${parsedRows.length} month(s)` +
                     (clients.length ? `, ${clients.length} clients` : '')

      } else {
        // Custom monthly summary — AI column mapping
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

      if (parsedRows.length === 0)
        throw new Error('No dated rows found. Check the date column is filled in.')

      const adSpendCol      = columns.find(c => c.mappedTo === 'ad_spend')
      const dateCol         = columns.find(c => c.mappedTo === 'date')
      const adSpendHasDates = !!(adSpendCol && dateCol)
      const totalAdSpend    = adSpendHasDates ? null
        : parsedRows.reduce((s, r) => s + (r.ad_spend ?? 0), 0) || null

      setClientRecords(clients)
      setLeadRecords(leads)
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
      const data = await res.json() as { imported: number }
      setImportedMonths(data.imported)

      // If we have individual records to import, go to step 2
      if (clientRecords.length > 0 || leadRecords.length > 0) {
        setState('records')
      } else {
        setState('done')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
      setState('previewing')
    }
  }

  async function handleImportRecords() {
    setRecordsWorking(true)
    setError(null)
    try {
      let created = 0, skipped = 0

      if (clientRecords.length > 0) {
        const res = await fetch('/api/import/clients', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clients: clientRecords, currency: 'NOK' }),
        })
        if (!res.ok) throw new Error('Failed to import clients')
        const d = await res.json() as { created: number; skipped: number }
        created += d.created; skipped += d.skipped
      }

      if (leadRecords.length > 0) {
        const res = await fetch('/api/import/leads', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ leads: leadRecords }),
        })
        if (!res.ok) throw new Error('Failed to import leads')
        const d = await res.json() as { created: number; skipped: number }
        created += d.created; skipped += d.skipped
      }

      setRecordsDone({ created, skipped })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setRecordsWorking(false)
    }
  }

  function handleReset() {
    setState('select-type')
    setImportType(null)
    setParseResult(null)
    setError(null)
    setImportedMonths(0)
    setPendingCsv('')
    setClientRecords([])
    setLeadRecords([])
    setRecordsDone(null)
  }

  // ── Done ──────────────────────────────────────────────────────────────────────
  if (state === 'done') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '48px 32px', textAlign: 'center' }}>
        <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(16,185,129,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg viewBox="0 0 24 24" fill="none" width="28" height="28" stroke="var(--success)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
        </div>
        <div>
          <p style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-1)', margin: 0 }}>Import complete</p>
          <p style={{ fontSize: 14, color: 'var(--text-2)', margin: '6px 0 0' }}>
            {importedMonths} month{importedMonths !== 1 ? 's' : ''} of data imported.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <a href="/numbers" className="btn-primary" style={{ textDecoration: 'none', display: 'inline-block' }}>View Numbers</a>
          <button onClick={handleReset} className="btn-ghost">Import more</button>
        </div>
      </div>
    )
  }

  // ── Importing spinner ─────────────────────────────────────────────────────────
  if (state === 'importing') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '48px 32px', textAlign: 'center' }}>
        <div style={{ width: 36, height: 36, borderRadius: '50%', border: '2px solid var(--neon-indigo)', borderTopColor: 'transparent', animation: 'spin 0.7s linear infinite' }} />
        <p style={{ fontSize: 14, color: 'var(--text-2)', margin: 0 }}>Importing monthly stats…</p>
      </div>
    )
  }

  // ── Step 2: individual records ────────────────────────────────────────────────
  if (state === 'records') {
    const allRecords = [...clientRecords, ...leadRecords]
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ padding: '12px 16px', background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 'var(--radius-btn)', fontSize: 12, color: 'var(--success)' }}>
          ✓ {importedMonths} month{importedMonths !== 1 ? 's' : ''} of stats imported
        </div>

        <div>
          <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-1)', margin: '0 0 4px' }}>
            Step 2 — Import individual records
          </p>
          <p style={{ fontSize: 12, color: 'var(--text-3)', margin: 0 }}>
            {clientRecords.length > 0 && `${clientRecords.length} client${clientRecords.length !== 1 ? 's' : ''} → Clients tab`}
            {clientRecords.length > 0 && leadRecords.length > 0 && ' · '}
            {leadRecords.length > 0 && `${leadRecords.length} closed deal${leadRecords.length !== 1 ? 's' : ''} → Pipeline`}
            {' '}(skips anyone already in the system)
          </p>
        </div>

        {/* Preview list */}
        <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-card)', overflow: 'hidden', maxHeight: 320, overflowY: 'auto' }}>
          {clientRecords.map((c, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderBottom: '1px solid var(--border)', fontSize: 12 }}>
              <div>
                <span style={{ fontWeight: 500, color: 'var(--text-1)' }}>{c.full_name}</span>
                <span style={{ color: 'var(--text-3)', marginLeft: 8 }}>{c.program_type}</span>
              </div>
              <div style={{ display: 'flex', gap: 12, color: 'var(--text-2)' }}>
                <span>{PAY_LABEL[c.payment_type]}</span>
                <span style={{ fontWeight: 500 }}>{c.total_amount.toLocaleString()} NOK</span>
              </div>
            </div>
          ))}
          {leadRecords.map((l, i) => {
            const stageLabel = l.stage === 'closed' ? 'Closed' : l.stage === 'replied' ? 'Replied' : 'Follower'
            const stageColor = l.stage === 'closed' ? 'var(--success)' : l.stage === 'replied' ? 'var(--accent)' : 'var(--text-3)'
            const stageBg    = l.stage === 'closed' ? 'rgba(16,185,129,0.1)' : l.stage === 'replied' ? 'rgba(99,102,241,0.1)' : 'var(--surface-2)'
            return (
              <div key={`lead-${i}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderBottom: '1px solid var(--border)', fontSize: 12 }}>
                <div>
                  <span style={{ fontWeight: 500, color: 'var(--text-1)' }}>{l.full_name}</span>
                  {l.followed_at && <span style={{ color: 'var(--text-3)', marginLeft: 8 }}>{l.followed_at.slice(0, 10)}</span>}
                </div>
                <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: stageBg, color: stageColor }}>{stageLabel}</span>
              </div>
            )
          })}
        </div>

        {error && (
          <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 'var(--radius-btn)', fontSize: 12, color: 'var(--danger)' }}>{error}</div>
        )}

        {recordsDone ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '16px 0' }}>
            <p style={{ fontSize: 14, color: 'var(--success)', margin: 0, fontWeight: 600 }}>
              ✓ {recordsDone.created} record{recordsDone.created !== 1 ? 's' : ''} added
              {recordsDone.skipped > 0 && `, ${recordsDone.skipped} already existed`}
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <a href="/clients" className="btn-primary" style={{ textDecoration: 'none', display: 'inline-block' }}>View Clients</a>
              <button onClick={handleReset} className="btn-ghost">Import more</button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={handleImportRecords}
              disabled={recordsWorking}
              className="btn-primary"
              style={{ opacity: recordsWorking ? 0.6 : 1 }}
            >
              {recordsWorking ? 'Importing…' : `Import ${allRecords.length} record${allRecords.length !== 1 ? 's' : ''}`}
            </button>
            <button onClick={() => setState('done')} className="btn-ghost">
              Skip
            </button>
          </div>
        )}
      </div>
    )
  }

  // ── Preview ───────────────────────────────────────────────────────────────────
  if (state === 'previewing' && parseResult) {
    return (
      <div>
        {error && <div style={{ marginBottom: 12, padding: '10px 14px', background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 'var(--radius-btn)', fontSize: 12, color: 'var(--danger)' }}>{error}</div>}
        <DataPreview parseResult={parseResult} onConfirm={handleConfirm} onReset={handleReset} />
      </div>
    )
  }

  // ── Type selector ─────────────────────────────────────────────────────────────
  if (state === 'select-type') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <p style={{ fontSize: 13, color: 'var(--text-2)', margin: 0 }}>What are you importing?</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {TYPE_OPTIONS.map(opt => (
            <button
              key={opt.key}
              onClick={() => selectType(opt.key)}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 6, padding: '14px 16px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-card)', cursor: 'pointer', textAlign: 'left', transition: 'border-color 150ms' }}
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

  // ── Upload ────────────────────────────────────────────────────────────────────
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
