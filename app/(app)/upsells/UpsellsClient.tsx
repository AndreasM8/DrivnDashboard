'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import type { UpsellRow } from './page'

interface Props {
  rows: UpsellRow[]
  upsellEnabled: boolean
  upsellTiming: string
  upsellMonths: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null
  const diff = new Date(dateStr).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)
  return Math.round(diff / 86400000)
}

function fmtDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en', { day: 'numeric', month: 'short', year: 'numeric' })
}

type UpsellStatus = 'overdue' | 'this_month' | 'next_month' | 'upcoming' | 'done' | 'no_date'

function getStatus(row: UpsellRow): UpsellStatus {
  if (row.taskCreated && !row.hasOpenTask && row.upsellDate) return 'done'
  if (!row.upsellDate) return 'no_date'
  const days = daysUntil(row.upsellDate)
  if (days === null) return 'no_date'
  if (days < 0)   return 'overdue'
  if (days <= 31) return 'this_month'
  if (days <= 62) return 'next_month'
  return 'upcoming'
}

const STATUS_META: Record<UpsellStatus, { label: string; accent: string; bg: string; order: number }> = {
  overdue:    { label: 'Overdue',        accent: '#DC2626', bg: 'rgba(220,38,38,0.08)',    order: 0 },
  this_month: { label: 'This month',     accent: '#D97706', bg: 'rgba(217,119,6,0.08)',    order: 1 },
  next_month: { label: 'Next month',     accent: '#2563EB', bg: 'rgba(37,99,235,0.07)',    order: 2 },
  upcoming:   { label: 'Coming up',      accent: '#6B7280', bg: 'rgba(107,114,128,0.07)', order: 3 },
  done:       { label: 'Task created',   accent: '#16A34A', bg: 'rgba(22,163,74,0.07)',   order: 4 },
  no_date:    { label: 'No timing set',  accent: '#9CA3AF', bg: 'rgba(156,163,175,0.07)', order: 5 },
}

// ─── Status pill ──────────────────────────────────────────────────────────────

function StatusPill({ days }: { days: number | null }) {
  if (days === null) return null
  if (days < 0)  return <span style={{ fontSize: 11, fontWeight: 600, color: '#DC2626' }}>{Math.abs(days)}d overdue</span>
  if (days === 0) return <span style={{ fontSize: 11, fontWeight: 600, color: '#D97706' }}>Today</span>
  if (days <= 7)  return <span style={{ fontSize: 11, fontWeight: 600, color: '#D97706' }}>In {days}d</span>
  return <span style={{ fontSize: 11, color: 'var(--text-3)' }}>In {days}d</span>
}

// ─── Section ──────────────────────────────────────────────────────────────────

function Section({ status, rows, onCreateTask, creatingId }: {
  status: UpsellStatus
  rows: UpsellRow[]
  onCreateTask: (clientId: string) => void
  creatingId: string | null
}) {
  const [open, setOpen] = useState(true)
  const meta = STATUS_META[status]
  if (rows.length === 0) return null

  return (
    <div style={{ marginBottom: 8 }}>
      {/* Section header */}
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          width:         '100%',
          display:       'flex',
          alignItems:    'center',
          justifyContent: 'space-between',
          padding:       '9px 16px',
          background:    meta.bg,
          borderTop:     `1px solid var(--border)`,
          borderRight:   '0',
          borderBottom:  '0',
          borderLeft:    `3px solid ${meta.accent}`,
          cursor:        'pointer',
          textAlign:     'left' as const,
        }}
      >
        <span style={{ fontSize: 12, fontWeight: 700, color: meta.accent, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {meta.label}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 600, background: meta.accent + '28', color: meta.accent, borderRadius: 20, padding: '1px 8px' }}>
            {rows.length}
          </span>
          <svg viewBox="0 0 20 20" fill="currentColor" width="13" height="13"
            style={{ color: 'var(--text-3)', transform: open ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 150ms ease' }}
          >
            <path fillRule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd"/>
          </svg>
        </div>
      </button>

      {/* Client rows */}
      {open && rows.map((row, i) => {
        const days = daysUntil(row.upsellDate)
        const canCreate = status !== 'done' && !row.hasOpenTask

        return (
          <div
            key={row.clientId}
            style={{
              display:       'flex',
              alignItems:    'center',
              gap:           12,
              padding:       '12px 16px',
              borderBottom:  i < rows.length - 1 ? '1px solid var(--border)' : 'none',
              background:    'var(--bg-base)',
            }}
          >
            {/* Client info */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)' }}>
                  {row.fullName || `@${row.igUsername}`}
                </span>
                {row.fullName && (
                  <span style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'monospace' }}>
                    @{row.igUsername}
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                {row.planMonths && (
                  <span style={{ fontSize: 11, color: 'var(--text-2)' }}>
                    {row.planMonths}-month plan
                  </span>
                )}
                {row.upsellDate && (
                  <span style={{ fontSize: 11, color: 'var(--text-2)' }}>
                    Upsell: {fmtDate(row.upsellDate)}
                  </span>
                )}
                {row.contractEndDate && (
                  <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
                    Ends: {fmtDate(row.contractEndDate)}
                  </span>
                )}
              </div>
            </div>

            {/* Days until */}
            <StatusPill days={days} />

            {/* Status / action */}
            {row.hasOpenTask ? (
              <span style={{ fontSize: 11, fontWeight: 600, color: '#16A34A', background: 'rgba(22,163,74,0.1)', borderRadius: 6, padding: '5px 10px', whiteSpace: 'nowrap' }}>
                ✓ Task open
              </span>
            ) : status === 'done' ? (
              <span style={{ fontSize: 11, color: 'var(--text-3)', whiteSpace: 'nowrap' }}>Done</span>
            ) : canCreate ? (
              <button
                onClick={() => onCreateTask(row.clientId)}
                disabled={creatingId === row.clientId}
                style={{
                  fontSize:    12,
                  fontWeight:  600,
                  padding:     '6px 12px',
                  borderRadius: 8,
                  border:      `1px solid ${meta.accent}40`,
                  background:  meta.bg,
                  color:       meta.accent,
                  cursor:      creatingId === row.clientId ? 'not-allowed' : 'pointer',
                  opacity:     creatingId === row.clientId ? 0.6 : 1,
                  whiteSpace:  'nowrap',
                  transition:  'all 120ms ease',
                }}
              >
                {creatingId === row.clientId ? 'Creating…' : 'Create task'}
              </button>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function UpsellsClient({ rows, upsellEnabled, upsellTiming, upsellMonths }: Props) {
  const router = useRouter()
  const [generating, setGenerating]   = useState(false)
  const [generated, setGenerated]     = useState(false)
  const [creatingId, setCreatingId]   = useState<string | null>(null)

  // Auto-generate tasks on page load
  useEffect(() => {
    fetch('/api/tasks/generate', { method: 'POST' })
      .then(() => setGenerated(true))
      .catch(() => {})
  }, [])

  async function handleRegenerate() {
    setGenerating(true)
    await fetch('/api/tasks/generate', { method: 'POST' })
    setGenerating(false)
    router.refresh()
  }

  async function handleCreateTask(clientId: string) {
    setCreatingId(clientId)
    // Hit generate endpoint (it will create for this client if due)
    // For a direct create we call generate and refresh
    await fetch('/api/tasks/generate', { method: 'POST' })
    setCreatingId(null)
    router.refresh()
  }

  // Group rows by status, sorted by upsell date within each group
  const grouped = useMemo(() => {
    const map: Partial<Record<UpsellStatus, UpsellRow[]>> = {}
    for (const row of rows) {
      const s = getStatus(row)
      if (!map[s]) map[s] = []
      map[s]!.push(row)
    }
    // Sort within each group by upsell date
    for (const group of Object.values(map)) {
      group?.sort((a, b) => {
        if (!a.upsellDate) return 1
        if (!b.upsellDate) return -1
        return a.upsellDate.localeCompare(b.upsellDate)
      })
    }
    return map
  }, [rows])

  const statusOrder: UpsellStatus[] = ['overdue', 'this_month', 'next_month', 'upcoming', 'done', 'no_date']

  const totalActive   = rows.filter(r => getStatus(r) !== 'done' && getStatus(r) !== 'no_date').length
  const totalOverdue  = (grouped.overdue ?? []).length
  const totalThisMonth = (grouped.this_month ?? []).length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

      {/* ── Top bar ──────────────────────────────────────────────────────────── */}
      <div style={{
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'space-between',
        padding:        '12px 24px',
        borderBottom:   '1px solid var(--border)',
        background:     'var(--surface-1)',
        flexShrink:     0,
        gap:            12,
        flexWrap:       'wrap',
      }}>
        <div>
          <h1 className="page-title">Upsells</h1>
          <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>
            {rows.length} active client{rows.length !== 1 ? 's' : ''}
            {totalOverdue > 0 && ` · ${totalOverdue} overdue`}
            {totalThisMonth > 0 && ` · ${totalThisMonth} due this month`}
          </p>
        </div>
        <button
          onClick={handleRegenerate}
          disabled={generating}
          className="btn-ghost"
          style={{ whiteSpace: 'nowrap' }}
        >
          {generating ? 'Generating…' : '↻ Refresh tasks'}
        </button>
      </div>

      {/* ── Settings notice if disabled ───────────────────────────────────────── */}
      {!upsellEnabled && (
        <div style={{ margin: '16px 24px 0', padding: '12px 16px', background: 'rgba(217,119,6,0.07)', border: '1px solid rgba(217,119,6,0.25)', borderRadius: 'var(--radius-card)', fontSize: 13, color: '#92400E', display: 'flex', alignItems: 'center', gap: 10 }}>
          <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14" style={{ flexShrink: 0 }}>
            <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd"/>
          </svg>
          Upsell reminders are disabled. Turn them on in Settings → Notifications to see upcoming opportunities.
        </div>
      )}

      {/* ── Summary cards ────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 10, padding: '16px 24px 0', flexShrink: 0, flexWrap: 'wrap' }}>
        {[
          {
            label:  'Overdue',
            value:  String(totalOverdue),
            accent: totalOverdue > 0 ? '#DC2626' : '#16A34A',
            sub:    totalOverdue > 0 ? 'Need attention now' : 'All clear',
          },
          {
            label:  'Due this month',
            value:  String(totalThisMonth),
            accent: totalThisMonth > 0 ? '#D97706' : 'var(--border-strong)',
            sub:    totalThisMonth > 0 ? 'Act on these soon' : 'Nothing yet',
          },
          {
            label:  'Upcoming',
            value:  String((grouped.next_month ?? []).length + (grouped.upcoming ?? []).length),
            accent: 'var(--border-strong)',
            sub:    'Next 2+ months',
          },
          {
            label:  'Task created',
            value:  String((grouped.done ?? []).length),
            accent: '#16A34A',
            sub:    'Follow-up logged',
          },
        ].map(card => (
          <div
            key={card.label}
            style={{
              flex:         '1 1 120px',
              background:   'var(--surface-1)',
              border:       '1px solid var(--border)',
              borderLeft:   `3px solid ${card.accent}`,
              borderRadius: 'var(--radius-card)',
              padding:      '12px 14px',
            }}
          >
            <p style={{ fontSize: 10, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-3)', marginBottom: 4 }}>{card.label}</p>
            <p style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-1)', letterSpacing: '-0.02em', lineHeight: 1, marginBottom: 3 }}>{card.value}</p>
            <p style={{ fontSize: 11, color: 'var(--text-2)' }}>{card.sub}</p>
          </div>
        ))}
      </div>

      {/* ── Config pill ───────────────────────────────────────────────────────── */}
      {upsellEnabled && (
        <div style={{ padding: '12px 24px 0', flexShrink: 0 }}>
          <span style={{ fontSize: 11, color: 'var(--text-3)', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 99, padding: '4px 10px' }}>
            Timing: {upsellMonths} month{upsellMonths !== 1 ? 's' : ''} {upsellTiming === 'before_end' ? 'before contract end' : 'after start'} · Change in Settings → Notifications
          </span>
        </div>
      )}

      {/* ── Client list ──────────────────────────────────────────────────────── */}
      <div style={{ overflowY: 'auto', flex: 1, paddingBottom: 88, marginTop: 16 }}>
        {rows.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--text-3)', fontSize: 13 }}>
            No active clients yet. Add clients on the Clients page.
          </div>
        ) : (
          statusOrder.map(status => (
            <Section
              key={status}
              status={status}
              rows={grouped[status] ?? []}
              onCreateTask={handleCreateTask}
              creatingId={creatingId}
            />
          ))
        )}
      </div>

    </div>
  )
}
