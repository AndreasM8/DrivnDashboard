'use client'

import { useState, useCallback } from 'react'
import type { ParseResult, ParsedRow, MappedField, ParsedColumn } from '@/app/api/import/parse/route'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  parseResult: ParseResult
  onConfirm: (rows: ParsedRow[], adSpendDistribution: 'equal' | 'none', totalAdSpend: number | null) => void
  onReset: () => void
}

const FIELD_LABELS: Record<MappedField, string> = {
  date:               'Date',
  revenue:            'Revenue',
  leads_count:        'Leads contacted',
  calls_booked:       'Calls booked',
  close_rate:         'Close rate',
  ad_spend:           'Ad spend',
  contracts_signed:   'Contracts signed',
  followers_gained:   'Followers gained',
  ignore:             'Ignore this column',
}

const ACTIVE_FIELDS: MappedField[] = [
  'date', 'revenue', 'leads_count', 'calls_booked',
  'close_rate', 'ad_spend', 'contracts_signed', 'followers_gained',
]

const AMBER_CELL: React.CSSProperties = {
  background: 'rgba(245,158,11,0.1)',
  border: '1px solid rgba(245,158,11,0.3)',
  borderRadius: 4,
}

// ─── Editable cell ─────────────────────────────────────────────────────────────

function EditableCell({
  value,
  type,
  isMissing,
  onChange,
}: {
  value: string | number | null
  type: 'text' | 'number' | 'date'
  isMissing: boolean
  onChange: (val: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')

  function startEdit() {
    setDraft(value !== null ? String(value) : '')
    setEditing(true)
  }

  function commit() {
    onChange(draft)
    setEditing(false)
  }

  const cellStyle: React.CSSProperties = {
    fontSize: 13,
    color: 'var(--text-1)',
    padding: '4px 6px',
    borderRadius: 4,
    minWidth: 80,
    ...(isMissing ? AMBER_CELL : {}),
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  }

  if (editing) {
    return (
      <input
        autoFocus
        type={type}
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false) }}
        style={{
          border: 'none',
          background: 'transparent',
          color: 'var(--text-1)',
          fontSize: 13,
          outline: '1px solid var(--neon-indigo)',
          borderRadius: 4,
          padding: '3px 6px',
          width: type === 'date' ? 130 : 80,
          fontFamily: 'var(--font-sans)',
        }}
      />
    )
  }

  return (
    <span style={cellStyle} onClick={startEdit} title="Click to edit">
      {value !== null ? String(value) : (
        <span style={{ color: 'rgba(245,158,11,0.7)', fontStyle: 'italic' }}>
          {type === 'date' ? 'missing date' : '—'}
        </span>
      )}
    </span>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function DataPreview({ parseResult, onConfirm, onReset }: Props) {
  const [columns, setColumns] = useState<ParsedColumn[]>(parseResult.columns)
  const [rows, setRows] = useState<ParsedRow[]>(parseResult.rows)

  // Replace uuid placeholder ids (from Claude) with real UUIDs
  const [initializedIds] = useState<boolean>(() => {
    // Mutate on first render only
    rows.forEach((r, i) => {
      if (r.id.startsWith('uuid-placeholder')) {
        r.id = `import-${i}-${Date.now()}`
      }
    })
    return true
  })
  void initializedIds

  const missingDates = rows.filter(r => r.date === null).length

  // Compute active columns (not ignored)
  const activeColumns = columns.filter(c => c.mappedTo !== 'ignore')

  function remapColumn(originalName: string, newField: MappedField) {
    setColumns(cols => cols.map(c => c.originalName === originalName ? { ...c, mappedTo: newField } : c))
  }

  function deleteRow(id: string) {
    setRows(rs => rs.filter(r => r.id !== id))
  }

  function updateRowField(id: string, field: keyof ParsedRow, rawVal: string) {
    setRows(rs => rs.map(r => {
      if (r.id !== id) return r
      if (field === 'date') {
        const trimmed = rawVal.trim()
        return { ...r, date: trimmed || null }
      }
      const num = parseFloat(rawVal.replace(/[^0-9.-]/g, ''))
      return { ...r, [field]: isNaN(num) ? null : num }
    }))
  }

  // Ad spend distribution logic
  const { adSpendHasDates, totalAdSpend: rawTotalAdSpend } = parseResult
  const showAdSpendBanner = !adSpendHasDates && rawTotalAdSpend !== null && rawTotalAdSpend > 0

  let adSpendMonthCount = 0
  let adSpendPerMonth = 0
  if (showAdSpendBanner && rows.length > 0) {
    const datedRows = rows.filter(r => r.date !== null)
    if (datedRows.length > 0) {
      const months = datedRows.map(r => r.date!.slice(0, 7)).sort()
      const first = months[0]
      const last = months[months.length - 1]
      // Count distinct months
      const [sy, sm] = first.split('-').map(Number)
      const [ey, em] = last.split('-').map(Number)
      adSpendMonthCount = (ey - sy) * 12 + (em - sm) + 1
      adSpendPerMonth = adSpendMonthCount > 0 ? (rawTotalAdSpend ?? 0) / adSpendMonthCount : 0
    }
  }

  const canConfirm = missingDates === 0

  const handleConfirm = useCallback(() => {
    const dist: 'equal' | 'none' = showAdSpendBanner ? 'equal' : 'none'
    const total = showAdSpendBanner ? rawTotalAdSpend : null
    onConfirm(rows, dist, total)
  }, [rows, showAdSpendBanner, rawTotalAdSpend, onConfirm])

  // Field type helper for edit cells
  function fieldType(field: MappedField): 'date' | 'number' | 'text' {
    if (field === 'date') return 'date'
    if (field === 'ignore') return 'text'
    return 'number'
  }

  function getRowValue(row: ParsedRow, field: MappedField): string | number | null {
    if (field === 'date') return row.date
    if (field === 'revenue') return row.revenue
    if (field === 'leads_count') return row.leads_count
    if (field === 'calls_booked') return row.calls_booked
    if (field === 'close_rate') return row.close_rate
    if (field === 'ad_spend') return row.ad_spend
    if (field === 'contracts_signed') return row.contracts_signed
    if (field === 'followers_gained') return row.followers_gained
    return null
  }

  function isFieldMissing(row: ParsedRow, field: MappedField): boolean {
    return getRowValue(row, field) === null
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Summary bar */}
      <div style={{
        background: 'var(--surface-2)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-btn)',
        padding: '8px 14px',
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        flexWrap: 'wrap',
        fontSize: 12,
        color: 'var(--text-2)',
      }}>
        <span>{parseResult.summary}</span>
        {missingDates > 0 && (
          <span style={{
            color: '#F59E0B',
            fontWeight: 500,
            background: 'rgba(245,158,11,0.08)',
            border: '1px solid rgba(245,158,11,0.2)',
            borderRadius: 4,
            padding: '2px 8px',
          }}>
            {missingDates} missing date{missingDates !== 1 ? 's' : ''} (highlighted)
          </span>
        )}
        <span style={{ color: 'var(--text-3)' }}>{rows.length} rows</span>
      </div>

      {/* Ad spend banner */}
      {showAdSpendBanner && (
        <div style={{
          background: 'rgba(99,102,241,0.07)',
          border: '1px solid rgba(99,102,241,0.25)',
          borderRadius: 'var(--radius-btn)',
          padding: '10px 14px',
          fontSize: 12,
          color: 'var(--text-2)',
          lineHeight: 1.5,
        }}>
          <span style={{ color: 'var(--neon-indigo)', fontWeight: 500 }}>Ad spend has no dates</span>
          {adSpendMonthCount > 0
            ? ` — will be distributed equally across ${adSpendMonthCount} month${adSpendMonthCount !== 1 ? 's' : ''} (NOK ${Math.round(adSpendPerMonth).toLocaleString()}/month).`
            : '.'}
        </div>
      )}

      {/* Table */}
      <div style={{
        background: 'var(--surface-1)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-card)',
        overflow: 'hidden',
      }}>
        <div style={{ overflowX: 'auto', maxHeight: 460, overflowY: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
              <tr style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
                {columns.map(col => (
                  <th key={col.originalName} style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 500, whiteSpace: 'nowrap' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                      <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{col.originalName}</span>
                      <select
                        value={col.mappedTo}
                        onChange={e => remapColumn(col.originalName, e.target.value as MappedField)}
                        style={{
                          background: 'var(--surface-3)',
                          border: '1px solid var(--border-strong)',
                          borderRadius: 4,
                          color: col.mappedTo === 'ignore' ? 'var(--text-3)' : 'var(--text-1)',
                          fontSize: 11,
                          padding: '2px 4px',
                          cursor: 'pointer',
                          outline: 'none',
                        }}
                      >
                        {ACTIVE_FIELDS.map(f => (
                          <option key={f} value={f}>{FIELD_LABELS[f]}</option>
                        ))}
                        <option value="ignore">{FIELD_LABELS.ignore}</option>
                      </select>
                    </div>
                  </th>
                ))}
                {/* Delete col */}
                <th style={{ padding: '8px 10px', width: 32 }} />
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr
                  key={row.id}
                  style={{
                    borderBottom: '1px solid var(--border)',
                    background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)',
                  }}
                >
                  {columns.map(col => {
                    if (col.mappedTo === 'ignore') {
                      return (
                        <td key={col.originalName} style={{ padding: '6px 10px', color: 'var(--text-3)', fontSize: 12 }}>
                          {row._originalValues[col.originalName] ?? '—'}
                        </td>
                      )
                    }
                    const field = col.mappedTo
                    const val = getRowValue(row, field)
                    const missing = isFieldMissing(row, field)
                    return (
                      <td key={col.originalName} style={{ padding: '6px 10px' }}>
                        <EditableCell
                          value={val}
                          type={fieldType(field)}
                          isMissing={missing}
                          onChange={raw => updateRowField(row.id, field as keyof ParsedRow, raw)}
                        />
                      </td>
                    )
                  })}
                  <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                    <button
                      onClick={() => deleteRow(row.id)}
                      title="Delete row"
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: 'var(--text-3)',
                        padding: 2,
                        lineHeight: 0,
                        borderRadius: 4,
                        transition: 'color 120ms ease',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.color = 'var(--danger)')}
                      onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-3)')}
                    >
                      <svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14">
                        <path d="M3.5 4.5l.8 8.4A1 1 0 005.3 14h5.4a1 1 0 001-.93L12.5 4.5M2 4h12M6 4V2.5A.5.5 0 016.5 2h3a.5.5 0 01.5.5V4M6.5 7v4M9.5 7v4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                      </svg>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 && (
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>
              All rows deleted
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingTop: 4 }}>
        <button
          onClick={onReset}
          style={{
            fontSize: 13, color: 'var(--text-3)', background: 'none',
            border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline',
            textDecorationColor: 'var(--border-strong)',
          }}
        >
          Start over
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {!canConfirm && (
            <span style={{ fontSize: 12, color: '#F59E0B' }}>
              Fill in {missingDates} missing date{missingDates !== 1 ? 's' : ''} first
            </span>
          )}
          <button
            onClick={handleConfirm}
            disabled={!canConfirm || rows.length === 0}
            className="btn-primary"
            style={(!canConfirm || rows.length === 0) ? { opacity: 0.4, cursor: 'not-allowed' } : undefined}
          >
            Confirm import
          </button>
        </div>
      </div>

      {/* Unused columns reference */}
      {activeColumns.length < columns.length && (
        <p style={{ fontSize: 11, color: 'var(--text-3)', margin: 0 }}>
          {columns.filter(c => c.mappedTo === 'ignore').length} column{columns.filter(c => c.mappedTo === 'ignore').length !== 1 ? 's' : ''} marked as ignored.
        </p>
      )}
    </div>
  )
}
