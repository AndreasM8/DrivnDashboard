'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import type { UpsellRow, EngagementRow } from './page'
import { useT } from '@/contexts/LanguageContext'

interface Props {
  rows: UpsellRow[]
  upsellEnabled: boolean
  upsellTiming: string
  upsellMonths: number
  testimonialRows: EngagementRow[]
  referralRows: EngagementRow[]
  testimonialEnabled: boolean
  testimonialInterval: number
  referralEnabled: boolean
  referralInterval: number
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

function monthsAgo(dateStr: string): number {
  const then = new Date(dateStr)
  const now = new Date()
  return (now.getFullYear() - then.getFullYear()) * 12 + (now.getMonth() - then.getMonth())
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

// ─── Upsell Section ───────────────────────────────────────────────────────────

function UpsellSection({ status, rows, onCreateTask, creatingId }: {
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

// ─── Engagement Section (Testimonials / Referrals) ────────────────────────────

type EngagementBucket = 'ask_soon' | 'recently_asked' | 'opted_out'

const ENGAGEMENT_META: Record<EngagementBucket, { label: string; accent: string; bg: string }> = {
  ask_soon:       { label: 'Ask soon',       accent: '#D97706', bg: 'rgba(217,119,6,0.08)' },
  recently_asked: { label: 'Recently asked', accent: '#16A34A', bg: 'rgba(22,163,74,0.07)' },
  opted_out:      { label: 'Opted out',      accent: '#9CA3AF', bg: 'rgba(156,163,175,0.07)' },
}

function getBucket(row: EngagementRow): EngagementBucket {
  if (row.optOut) return 'opted_out'
  if (!row.lastRequestedAt) return 'ask_soon'
  const ago = monthsAgo(row.lastRequestedAt)
  if (ago >= row.intervalMonths) return 'ask_soon'
  return 'recently_asked'
}

function EngagementSection({ bucket, rows, type, onLogAsk, onToggleOptOut, actingId }: {
  bucket: EngagementBucket
  rows: EngagementRow[]
  type: 'testimonial' | 'referral'
  onLogAsk: (clientId: string) => void
  onToggleOptOut: (clientId: string, current: boolean) => void
  actingId: string | null
}) {
  const [open, setOpen] = useState(true)
  const t = useT()
  const meta = ENGAGEMENT_META[bucket]
  const bucketLabel = bucket === 'ask_soon' ? t.upsells.askSoon : bucket === 'recently_asked' ? t.upsells.recentlyAsked : t.upsells.optedOut
  if (rows.length === 0) return null

  return (
    <div style={{ marginBottom: 8 }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          width:          '100%',
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'space-between',
          padding:        '9px 16px',
          background:     meta.bg,
          borderTop:      '1px solid var(--border)',
          borderRight:    '0',
          borderBottom:   '0',
          borderLeft:     `3px solid ${meta.accent}`,
          cursor:         'pointer',
          textAlign:      'left' as const,
        }}
      >
        <span style={{ fontSize: 12, fontWeight: 700, color: meta.accent, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {bucketLabel}
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

      {open && rows.map((row, i) => (
        <div
          key={row.clientId}
          style={{
            display:      'flex',
            alignItems:   'center',
            gap:          12,
            padding:      '12px 16px',
            borderBottom: i < rows.length - 1 ? '1px solid var(--border)' : 'none',
            background:   'var(--bg-base)',
          }}
        >
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
            <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
              {row.lastRequestedAt
                ? `${t.upsells.lastAsked}: ${fmtDate(row.lastRequestedAt)}`
                : t.upsells.neverAsked}
            </span>
          </div>

          {/* Log ask button */}
          {!row.optOut && (
            <button
              onClick={() => onLogAsk(row.clientId)}
              disabled={actingId === row.clientId + '_ask'}
              style={{
                fontSize:    12,
                fontWeight:  600,
                padding:     '6px 12px',
                borderRadius: 8,
                border:      `1px solid ${meta.accent}40`,
                background:  meta.bg,
                color:       meta.accent,
                cursor:      actingId === row.clientId + '_ask' ? 'not-allowed' : 'pointer',
                opacity:     actingId === row.clientId + '_ask' ? 0.6 : 1,
                whiteSpace:  'nowrap',
                transition:  'all 120ms ease',
              }}
            >
              {actingId === row.clientId + '_ask' ? t.common.saving : t.upsells.logAsk}
            </button>
          )}

          {/* Mute toggle (bell icon) */}
          <button
            onClick={() => onToggleOptOut(row.clientId, row.optOut)}
            disabled={actingId === row.clientId + '_mute'}
            title={row.optOut ? `Unmute ${type} requests` : `Mute ${type} requests`}
            style={{
              background: 'none',
              border:     'none',
              cursor:     actingId === row.clientId + '_mute' ? 'not-allowed' : 'pointer',
              padding:    4,
              color:      row.optOut ? 'var(--text-3)' : 'var(--text-2)',
              opacity:    actingId === row.clientId + '_mute' ? 0.5 : 1,
              flexShrink: 0,
            }}
          >
            {row.optOut ? (
              // Bell-slash
              <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
                <path d="M3.28 2.22a.75.75 0 0 0-1.06 1.06l14.5 14.5a.75.75 0 1 0 1.06-1.06L3.28 2.22ZM10 2a6 6 0 0 0-5.94 5.11L3.12 6.17A7.5 7.5 0 0 1 15.5 9.5v3.586l-2-2V9.5A5.5 5.5 0 0 0 10 4a5.48 5.48 0 0 0-3.5 1.257V9.5l-2-2V9.5c0-.17.007-.34.02-.507zM3.5 13.086V9.5c0-.172.009-.341.026-.509L2.063 7.528A7.474 7.474 0 0 0 2 9.5v3.586L.22 14.86A.75.75 0 0 0 .75 16h9.793l-1.5-1.5H2.457l.293-.293.75-.621zM8.305 16.5a1.75 1.75 0 0 0 3.39 0H8.305z"/>
              </svg>
            ) : (
              // Bell
              <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
                <path fillRule="evenodd" d="M10 2a6 6 0 0 0-6 6v3.586l-.707.707A1 1 0 0 0 4 14h12a1 1 0 0 0 .707-1.707L16 11.586V8a6 6 0 0 0-6-6ZM10 18a3 3 0 0 1-2.83-2h5.66A3 3 0 0 1 10 18Z" clipRule="evenodd"/>
              </svg>
            )}
          </button>
        </div>
      ))}
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function UpsellsClient({
  rows,
  upsellEnabled,
  upsellTiming,
  upsellMonths,
  testimonialRows,
  referralRows,
  testimonialEnabled,
  testimonialInterval,
  referralEnabled,
  referralInterval,
}: Props) {
  const router = useRouter()
  const t = useT()
  const [activeTab, setActiveTab] = useState<'upsells' | 'testimonials' | 'referrals'>('upsells')
  const [generating, setGenerating]   = useState(false)
  const [generated, setGenerated]     = useState(false)
  const [creatingId, setCreatingId]   = useState<string | null>(null)
  const [actingId, setActingId]       = useState<string | null>(null)
  // Local optimistic state for engagement rows
  const [localTestimonials, setLocalTestimonials] = useState<EngagementRow[]>(testimonialRows)
  const [localReferrals, setLocalReferrals]       = useState<EngagementRow[]>(referralRows)

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
    await fetch('/api/tasks/generate', { method: 'POST' })
    setCreatingId(null)
    router.refresh()
  }

  async function handleLogAsk(type: 'testimonial' | 'referral', clientId: string) {
    const key = clientId + '_ask'
    setActingId(key)
    const field = type === 'testimonial' ? 'testimonial_requested_at' : 'referral_requested_at'
    const now = new Date().toISOString()

    const res = await fetch(`/api/clients/${clientId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: now }),
    })

    if (res.ok) {
      if (type === 'testimonial') {
        setLocalTestimonials(prev => prev.map(r => r.clientId === clientId ? { ...r, lastRequestedAt: now } : r))
      } else {
        setLocalReferrals(prev => prev.map(r => r.clientId === clientId ? { ...r, lastRequestedAt: now } : r))
      }
    }
    setActingId(null)
  }

  async function handleToggleOptOut(type: 'testimonial' | 'referral', clientId: string, current: boolean) {
    const key = clientId + '_mute'
    setActingId(key)
    const field = type === 'testimonial' ? 'testimonial_opt_out' : 'referral_opt_out'

    const res = await fetch(`/api/clients/${clientId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: !current }),
    })

    if (res.ok) {
      if (type === 'testimonial') {
        setLocalTestimonials(prev => prev.map(r => r.clientId === clientId ? { ...r, optOut: !current } : r))
      } else {
        setLocalReferrals(prev => prev.map(r => r.clientId === clientId ? { ...r, optOut: !current } : r))
      }
    }
    setActingId(null)
  }

  // Group upsell rows by status, sorted by upsell date within each group
  const grouped = useMemo(() => {
    const map: Partial<Record<UpsellStatus, UpsellRow[]>> = {}
    for (const row of rows) {
      const s = getStatus(row)
      if (!map[s]) map[s] = []
      map[s]!.push(row)
    }
    for (const group of Object.values(map)) {
      group?.sort((a, b) => {
        if (!a.upsellDate) return 1
        if (!b.upsellDate) return -1
        return a.upsellDate.localeCompare(b.upsellDate)
      })
    }
    return map
  }, [rows])

  // Group engagement rows
  const groupedTestimonials = useMemo(() => {
    const map: Partial<Record<EngagementBucket, EngagementRow[]>> = {}
    for (const row of localTestimonials) {
      const b = getBucket(row)
      if (!map[b]) map[b] = []
      map[b]!.push(row)
    }
    return map
  }, [localTestimonials])

  const groupedReferrals = useMemo(() => {
    const map: Partial<Record<EngagementBucket, EngagementRow[]>> = {}
    for (const row of localReferrals) {
      const b = getBucket(row)
      if (!map[b]) map[b] = []
      map[b]!.push(row)
    }
    return map
  }, [localReferrals])

  const statusOrder: UpsellStatus[] = ['overdue', 'this_month', 'next_month', 'upcoming', 'done', 'no_date']
  const bucketOrder: EngagementBucket[] = ['ask_soon', 'recently_asked', 'opted_out']

  const totalActive    = rows.filter(r => getStatus(r) !== 'done' && getStatus(r) !== 'no_date').length
  const totalOverdue   = (grouped.overdue ?? []).length
  const totalThisMonth = (grouped.this_month ?? []).length

  const tabs: { key: 'upsells' | 'testimonials' | 'referrals'; label: string }[] = [
    { key: 'upsells',      label: t.upsells.upsells },
    { key: 'testimonials', label: t.upsells.testimonials },
    { key: 'referrals',    label: t.upsells.referrals },
  ]

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
          <h1 className="page-title">Upsells &amp; Engagement</h1>
          <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>
            {rows.length} active client{rows.length !== 1 ? 's' : ''}
            {totalOverdue > 0 && ` · ${totalOverdue} overdue`}
            {totalThisMonth > 0 && ` · ${totalThisMonth} due this month`}
          </p>
        </div>
        {activeTab === 'upsells' && (
          <button
            onClick={handleRegenerate}
            disabled={generating}
            className="btn-ghost"
            style={{ whiteSpace: 'nowrap' }}
          >
            {generating ? 'Generating…' : '↻ Refresh tasks'}
          </button>
        )}
      </div>

      {/* ── Tabs ─────────────────────────────────────────────────────────────── */}
      <div style={{
        display:      'flex',
        gap:          0,
        borderBottom: '1px solid var(--border)',
        background:   'var(--surface-1)',
        flexShrink:   0,
        padding:      '0 24px',
      }}>
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding:        '10px 16px',
              fontSize:       13,
              fontWeight:     activeTab === tab.key ? 600 : 400,
              color:          activeTab === tab.key ? 'var(--accent)' : 'var(--text-2)',
              background:     'none',
              border:         'none',
              borderBottom:   activeTab === tab.key ? '2px solid var(--accent)' : '2px solid transparent',
              cursor:         'pointer',
              transition:     'all 120ms ease',
              marginBottom:   -1,
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── UPSELLS TAB ──────────────────────────────────────────────────────── */}
      {activeTab === 'upsells' && (
        <>
          {/* Settings notice if disabled */}
          {!upsellEnabled && (
            <div style={{ margin: '16px 24px 0', padding: '12px 16px', background: 'rgba(217,119,6,0.07)', border: '1px solid rgba(217,119,6,0.25)', borderRadius: 'var(--radius-card)', fontSize: 13, color: '#92400E', display: 'flex', alignItems: 'center', gap: 10 }}>
              <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14" style={{ flexShrink: 0 }}>
                <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd"/>
              </svg>
              Upsell reminders are disabled. Turn them on in Settings → Notifications to see upcoming opportunities.
            </div>
          )}

          {/* Summary cards */}
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

          {/* Config pill */}
          {upsellEnabled && (
            <div style={{ padding: '12px 24px 0', flexShrink: 0 }}>
              <span style={{ fontSize: 11, color: 'var(--text-3)', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 99, padding: '4px 10px' }}>
                Timing: {upsellMonths} month{upsellMonths !== 1 ? 's' : ''} {upsellTiming === 'before_end' ? 'before contract end' : 'after start'} · Change in Settings → Notifications
              </span>
            </div>
          )}

          {/* Client list */}
          <div style={{ overflowY: 'auto', flex: 1, paddingBottom: 88, marginTop: 16 }}>
            {rows.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--text-3)', fontSize: 13 }}>
                No active clients yet. Add clients on the Clients page.
              </div>
            ) : (
              statusOrder.map(status => (
                <UpsellSection
                  key={status}
                  status={status}
                  rows={grouped[status] ?? []}
                  onCreateTask={handleCreateTask}
                  creatingId={creatingId}
                />
              ))
            )}
          </div>
        </>
      )}

      {/* ── TESTIMONIALS TAB ─────────────────────────────────────────────────── */}
      {activeTab === 'testimonials' && (
        <>
          {!testimonialEnabled && (
            <div style={{ margin: '16px 24px 0', padding: '12px 16px', background: 'rgba(217,119,6,0.07)', border: '1px solid rgba(217,119,6,0.25)', borderRadius: 'var(--radius-card)', fontSize: 13, color: '#92400E', display: 'flex', alignItems: 'center', gap: 10 }}>
              <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14" style={{ flexShrink: 0 }}>
                <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd"/>
              </svg>
              Testimonial reminders are disabled. Turn them on in Settings → Notifications.
            </div>
          )}

          <div style={{ padding: '12px 24px 0', flexShrink: 0 }}>
            <span style={{ fontSize: 11, color: 'var(--text-3)', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 99, padding: '4px 10px' }}>
              Ask every {testimonialInterval} month{testimonialInterval !== 1 ? 's' : ''} · Change in Settings → Notifications
            </span>
          </div>

          <div style={{ overflowY: 'auto', flex: 1, paddingBottom: 88, marginTop: 16 }}>
            {localTestimonials.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--text-3)', fontSize: 13 }}>
                No active clients yet.
              </div>
            ) : (
              bucketOrder.map(bucket => (
                <EngagementSection
                  key={bucket}
                  bucket={bucket}
                  rows={groupedTestimonials[bucket] ?? []}
                  type="testimonial"
                  onLogAsk={id => handleLogAsk('testimonial', id)}
                  onToggleOptOut={(id, cur) => handleToggleOptOut('testimonial', id, cur)}
                  actingId={actingId}
                />
              ))
            )}
          </div>
        </>
      )}

      {/* ── REFERRALS TAB ────────────────────────────────────────────────────── */}
      {activeTab === 'referrals' && (
        <>
          {!referralEnabled && (
            <div style={{ margin: '16px 24px 0', padding: '12px 16px', background: 'rgba(217,119,6,0.07)', border: '1px solid rgba(217,119,6,0.25)', borderRadius: 'var(--radius-card)', fontSize: 13, color: '#92400E', display: 'flex', alignItems: 'center', gap: 10 }}>
              <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14" style={{ flexShrink: 0 }}>
                <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd"/>
              </svg>
              Referral reminders are disabled. Turn them on in Settings → Notifications.
            </div>
          )}

          <div style={{ padding: '12px 24px 0', flexShrink: 0 }}>
            <span style={{ fontSize: 11, color: 'var(--text-3)', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 99, padding: '4px 10px' }}>
              Ask every {referralInterval} month{referralInterval !== 1 ? 's' : ''} · Change in Settings → Notifications
            </span>
          </div>

          <div style={{ overflowY: 'auto', flex: 1, paddingBottom: 88, marginTop: 16 }}>
            {localReferrals.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--text-3)', fontSize: 13 }}>
                No active clients yet.
              </div>
            ) : (
              bucketOrder.map(bucket => (
                <EngagementSection
                  key={bucket}
                  bucket={bucket}
                  rows={groupedReferrals[bucket] ?? []}
                  type="referral"
                  onLogAsk={id => handleLogAsk('referral', id)}
                  onToggleOptOut={(id, cur) => handleToggleOptOut('referral', id, cur)}
                  actingId={actingId}
                />
              ))
            )}
          </div>
        </>
      )}

    </div>
  )
}
