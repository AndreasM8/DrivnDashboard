'use client'

import { useState } from 'react'
import CsvUploader from './CsvUploader'
import DataPreview from './DataPreview'
import type { ParseResult, ParsedRow } from '@/app/api/import/parse/route'

// ─── Types ────────────────────────────────────────────────────────────────────

type ImportState = 'idle' | 'previewing' | 'importing' | 'done'

// ─── Component ────────────────────────────────────────────────────────────────

export default function ImportClient() {
  const [state, setState] = useState<ImportState>('idle')
  const [parsing, setParsing] = useState(false)
  const [parseResult, setParseResult] = useState<ParseResult | null>(null)
  const [importedMonths, setImportedMonths] = useState<number>(0)
  const [error, setError] = useState<string | null>(null)
  const [pendingCsvText, setPendingCsvText] = useState<string>('')

  async function parseCSV(csvText: string) {
    setError(null)
    setParsing(true)
    setPendingCsvText(csvText)

    try {
      const res = await fetch('/api/import/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csvText }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(body.error ?? `Parse failed (HTTP ${res.status})`)
      }

      const result = await res.json() as ParseResult

      // Replace placeholder IDs with real UUIDs
      result.rows = result.rows.map(r => ({
        ...r,
        id: r.id.startsWith('uuid-placeholder') ? crypto.randomUUID() : r.id,
      }))

      setParseResult(result)
      setState('previewing')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setParsing(false)
    }
  }

  async function handleFileLoaded(csvText: string) {
    await parseCSV(csvText)
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
    setState('idle')
    setParseResult(null)
    setError(null)
    setImportedMonths(0)
  }

  if (state === 'done') {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 16,
        padding: '48px 32px',
        textAlign: 'center',
      }}>
        <div style={{
          width: 56, height: 56, borderRadius: '50%',
          background: 'rgba(16,185,129,0.12)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg viewBox="0 0 24 24" fill="none" width="28" height="28" stroke="var(--success)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6L9 17l-5-5" />
          </svg>
        </div>
        <div>
          <p style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-1)', margin: 0 }}>
            Import complete
          </p>
          <p style={{ fontSize: 14, color: 'var(--text-2)', margin: '6px 0 0' }}>
            {importedMonths} month{importedMonths !== 1 ? 's' : ''} of data imported successfully.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <a
            href="/numbers"
            className="btn-primary"
            style={{ textDecoration: 'none', display: 'inline-block' }}
          >
            View Numbers
          </a>
          <button onClick={handleReset} className="btn-ghost">
            Import more
          </button>
        </div>
      </div>
    )
  }

  if (state === 'importing') {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 16,
        padding: '48px 32px',
        textAlign: 'center',
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: '50%',
          border: '2px solid var(--neon-indigo)',
          borderTopColor: 'transparent',
          animation: 'spin 0.7s linear infinite',
        }} />
        <p style={{ fontSize: 14, color: 'var(--text-2)', margin: 0 }}>
          Importing your data…
        </p>
      </div>
    )
  }

  if (state === 'previewing' && parseResult) {
    return (
      <div>
        {error && (
          <div style={{
            marginBottom: 12,
            padding: '10px 14px',
            background: 'rgba(239,68,68,0.07)',
            border: '1px solid rgba(239,68,68,0.2)',
            borderRadius: 'var(--radius-btn)',
            fontSize: 12,
            color: 'var(--danger)',
          }}>
            {error}
          </div>
        )}
        <DataPreview
          parseResult={parseResult}
          onConfirm={handleConfirm}
          onReset={handleReset}
        />
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {error && (
        <div style={{
          padding: '10px 14px',
          background: 'rgba(239,68,68,0.07)',
          border: '1px solid rgba(239,68,68,0.2)',
          borderRadius: 'var(--radius-btn)',
          fontSize: 12,
          color: 'var(--danger)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
        }}>
          <span>{error}</span>
          {pendingCsvText && (
            <button
              onClick={() => parseCSV(pendingCsvText)}
              style={{
                flexShrink: 0,
                fontSize: 12,
                color: 'var(--danger)',
                background: 'none',
                border: '1px solid rgba(239,68,68,0.4)',
                borderRadius: 'var(--radius-btn)',
                padding: '3px 10px',
                cursor: 'pointer',
              }}
            >
              Try again
            </button>
          )}
        </div>
      )}

      <CsvUploader onFileLoaded={handleFileLoaded} loading={parsing} />

      <div style={{
        padding: '12px 14px',
        background: 'var(--surface-2)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-btn)',
        fontSize: 12,
        color: 'var(--text-3)',
        lineHeight: 1.6,
      }}>
        <strong style={{ color: 'var(--text-2)', display: 'block', marginBottom: 4 }}>What gets imported</strong>
        Columns detected: date, revenue, leads contacted, calls booked, close rate, ad spend, contracts signed, followers gained.
        Claude will intelligently map your column headers — you can fix any mistakes in the preview.
      </div>
    </div>
  )
}
