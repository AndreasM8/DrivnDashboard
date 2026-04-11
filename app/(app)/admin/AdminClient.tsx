'use client'

import { useRouter } from 'next/navigation'
import { useState, useMemo } from 'react'
import type { CoachStats } from './page'
import { useT } from '@/contexts/LanguageContext'

interface TeamMemberRow {
  id: string
  coach_id: string
  name: string
  email: string
  role: string
  status: string
}

interface TodayEodRow {
  team_member_id: string
  submitted_at: string
}

interface Props {
  coachStats: CoachStats[]
  currentMonth: string
  missingCheckins: string[]
  teamMembers: TeamMemberRow[]
  todayEods: TodayEodRow[]
}

type SortKey = 'name' | 'totalLeads' | 'replyRate' | 'bookingRate' | 'closeRate'
  | 'cashThisMonth' | 'clientsSignedThisMonth' | 'lastLogin'
type NumbersSortKey = 'name' | 'activeClients' | 'totalContractedValue' | 'cashThisMonth' | 'clientsSignedThisMonth' | 'contractsThisMonth'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return 'Never'
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs  = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

function fmtMonth(month: string) {
  const [y, m] = month.split('-')
  return new Date(Number(y), Number(m) - 1).toLocaleDateString('en', { month: 'long', year: 'numeric' })
}

function ratePill(rate: number | null, greenAt: number, amberAt: number) {
  if (rate === null) return { text: '—', color: 'var(--text-3)', bg: 'transparent' }
  const color = rate >= greenAt ? '#16A34A' : rate >= amberAt ? '#D97706' : '#DC2626'
  const bg    = rate >= greenAt ? 'rgba(22,163,74,0.1)' : rate >= amberAt ? 'rgba(217,119,6,0.1)' : 'rgba(220,38,38,0.08)'
  return { text: `${rate}%`, color, bg }
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, accent }: {
  label: string; value: string; sub?: string; accent?: string
}) {
  return (
    <div style={{
      background:   'var(--surface-1)',
      border:       '1px solid var(--border)',
      borderLeft:   `3px solid ${accent ?? 'var(--border-strong)'}`,
      borderRadius: 'var(--radius-card)',
      padding:      '16px 18px',
      boxShadow:    'var(--shadow-card)',
    }}>
      <p style={{ fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-3)', marginBottom: 6 }}>
        {label}
      </p>
      <p style={{ fontSize: 28, fontWeight: 700, color: 'var(--text-1)', letterSpacing: '-0.02em', lineHeight: 1, marginBottom: sub ? 4 : 0 }}>
        {value}
      </p>
      {sub && <p style={{ fontSize: 11, color: 'var(--text-2)' }}>{sub}</p>}
    </div>
  )
}

// ─── Aggregate funnel ─────────────────────────────────────────────────────────

function AggregateFunnel({ coaches }: { coaches: CoachStats[] }) {
  const t          = useT()
  const totLeads   = coaches.reduce((s, c) => s + c.totalLeads, 0)
  const totReplied = coaches.reduce((s, c) => s + c.totalReplied, 0)
  const totBooked  = coaches.reduce((s, c) => s + c.totalBooked, 0)
  const totClosed  = coaches.reduce((s, c) => s + c.totalClosed, 0)

  if (totLeads === 0) return (
    <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-3)', fontSize: 13 }}>
      {t.admin.noData}
    </div>
  )

  const replyRate   = totLeads   > 0 ? Math.round((totReplied / totLeads)   * 100) : null
  const bookingRate = totReplied > 0 ? Math.round((totBooked  / totReplied) * 100) : null
  const closeRate   = totBooked  > 0 ? Math.round((totClosed  / totBooked)  * 100) : null

  const rates      = [replyRate, bookingRate, closeRate]
  const rateLabels = [t.admin.replyRate, t.admin.bookingRate, t.admin.closeRate]
  const greenAts   = [15, 30, 25]
  const amberAts   = [8,  15, 15]

  const steps = [
    { label: 'Total leads', count: totLeads },
    { label: 'Replied',     count: totReplied },
    { label: 'Call booked', count: totBooked },
    { label: 'Closed',      count: totClosed },
  ]

  // Find the stage with the lowest conversion rate → "weakest link"
  const weakest = rates.reduce<number | null>((worst, r, i) => {
    if (r === null) return worst
    if (worst === null) return i
    return r < (rates[worst] ?? 100) ? i : worst
  }, null)

  const weakestInsight = [
    'Coaches need to improve their outreach and opener quality.',
    'Getting replies but struggling to book calls — work on the offer and CTA.',
    'Calls booked but not closing — focus on call structure and objection handling.',
  ]

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        {steps.map((step, i) => {
          const rate      = rates[i - 1] ?? null
          const isWeakest = i > 0 && weakest === i - 1
          const pill      = isWeakest && rate !== null
            ? ratePill(rate, greenAts[i - 1], amberAts[i - 1])
            : null

          return (
            <div key={step.label} style={{ display: 'flex', alignItems: 'center', flex: 1, minWidth: 0 }}>
              <div style={{
                flex: 1,
                background:   'var(--surface-2)',
                border:       isWeakest ? '2px solid #DC2626' : '1px solid var(--border)',
                borderRadius: 10,
                padding:      '14px 16px',
                minWidth:     0,
              }}>
                <p style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-1)', letterSpacing: '-0.02em', lineHeight: 1.1, marginBottom: 4 }}>
                  {step.count.toLocaleString()}
                </p>
                <p style={{ fontSize: 10, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-3)' }}>
                  {step.label}
                </p>
              </div>

              {i < steps.length - 1 && (() => {
                const r = rates[i]
                const { color } = ratePill(r, greenAts[i], amberAts[i])
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0 8px', flexShrink: 0 }}>
                    <p style={{ fontSize: 9, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-3)', marginBottom: 2, whiteSpace: 'nowrap' }}>
                      {rateLabels[i]}
                    </p>
                    <p style={{ fontSize: 15, fontWeight: 700, color, lineHeight: 1, marginBottom: 2 }}>
                      {r !== null ? `${r}%` : '—'}
                    </p>
                    <svg width="20" height="12" viewBox="0 0 20 12" fill="none">
                      <path d="M0 6H16M16 6L11 1M16 6L11 11" stroke="var(--text-3)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                )
              })()}
            </div>
          )
        })}
      </div>

      {weakest !== null && (
        <div style={{
          marginTop:  12,
          display:    'flex',
          alignItems: 'flex-start',
          gap:        8,
          padding:    '10px 14px',
          background: 'rgba(220,38,38,0.06)',
          border:     '1px solid rgba(220,38,38,0.2)',
          borderRadius: 8,
          fontSize:   13,
          color:      '#DC2626',
        }}>
          <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14" style={{ flexShrink: 0, marginTop: 2 }}>
            <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd"/>
          </svg>
          <span>
            <strong>Biggest drop-off: {rateLabels[weakest]}</strong> — only {rates[weakest]}% conversion at this stage.{' '}
            {weakestInsight[weakest]}
          </span>
        </div>
      )}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

// ─── Team Section ─────────────────────────────────────────────────────────────

function TeamSection({
  teamMembers,
  todayEods,
  coachStats,
}: {
  teamMembers: TeamMemberRow[]
  todayEods: TodayEodRow[]
  coachStats: CoachStats[]
}) {
  const t = useT()
  if (teamMembers.length === 0) return null

  const eodSubmittedIds = new Set(todayEods.map(e => e.team_member_id))

  // Group team members by coach_id
  const byCoach = new Map<string, TeamMemberRow[]>()
  for (const m of teamMembers) {
    const list = byCoach.get(m.coach_id) ?? []
    list.push(m)
    byCoach.set(m.coach_id, list)
  }

  const coachNameMap = new Map<string, string>()
  for (const c of coachStats) {
    coachNameMap.set(c.userId, c.name)
  }

  return (
    <div>
      <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-3)', marginBottom: 12 }}>
        {t.admin.team}
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {Array.from(byCoach.entries()).map(([coachId, members]) => {
          const coachName = coachNameMap.get(coachId) ?? coachId
          return (
            <div key={coachId}>
              <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-2)', marginBottom: 8 }}>
                {coachName}
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {members.map(m => {
                  const submitted = eodSubmittedIds.has(m.id)
                  const roleColor = m.role === 'setter' ? '#7C3AED' : '#2563EB'
                  const roleBg = m.role === 'setter' ? 'rgba(124,58,237,0.1)' : 'rgba(37,99,235,0.1)'

                  return (
                    <div
                      key={m.id}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        padding: '12px 16px',
                        background: 'var(--surface-1)',
                        border: '1px solid var(--border)',
                        borderRadius: 10,
                      }}
                    >
                      {/* Avatar */}
                      <div style={{
                        width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                        background: roleBg, color: roleColor,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 13, fontWeight: 700,
                      }}>
                        {m.name.charAt(0).toUpperCase()}
                      </div>

                      {/* Name + role */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)' }}>{m.name}</span>
                          <span style={{
                            fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 4,
                            background: roleBg, color: roleColor,
                            textTransform: 'uppercase', letterSpacing: '0.06em',
                          }}>
                            {m.role}
                          </span>
                          {m.status === 'invited' && (
                            <span style={{
                              fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 4,
                              background: 'rgba(245,158,11,0.1)', color: '#F59E0B',
                              textTransform: 'uppercase', letterSpacing: '0.06em',
                            }}>
                              Invited
                            </span>
                          )}
                        </div>
                        <p style={{ fontSize: 11, color: 'var(--text-3)', margin: 0 }}>{m.email}</p>
                      </div>

                      {/* EOD status */}
                      <div style={{ flexShrink: 0, textAlign: 'right' }}>
                        <p style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-3)', marginBottom: 3 }}>
                          EOD
                        </p>
                        <span style={{
                          fontSize: 12, fontWeight: 600,
                          color: submitted ? '#10B981' : '#D97706',
                        }}>
                          {submitted ? `✓ ${t.admin.eodSubmitted}` : `⏳ ${t.admin.eodPending}`}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function AdminClient({ coachStats, currentMonth, missingCheckins, teamMembers, todayEods }: Props) {
  const router    = useRouter()
  const t         = useT()
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [tab,       setTab]       = useState<'overview' | 'numbers' | 'coaches'>('overview')
  const [nSortKey,  setNSortKey]  = useState<NumbersSortKey>('cashThisMonth')
  const [nSortDir,  setNSortDir]  = useState<'desc' | 'asc'>('desc')
  const [sortKey,   setSortKey]   = useState<SortKey>('totalLeads')
  const [sortDir,   setSortDir]   = useState<'desc' | 'asc'>('desc')

  async function handleViewAs(userId: string, name: string) {
    setLoadingId(userId)
    const res = await fetch('/api/admin/view-as', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ coachId: userId, coachName: name }),
    })
    if (res.ok) { router.push('/dashboard'); router.refresh() }
    else { setLoadingId(null); alert('Failed to switch view') }
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'desc' ? 'asc' : 'desc')
    else { setSortKey(key); setSortDir('desc') }
  }

  const sortedCoaches = useMemo(() => {
    return [...coachStats].sort((a, b) => {
      const av = a[sortKey]
      const bv = b[sortKey]
      // nulls always last
      if (av == null && bv == null) return 0
      if (av == null) return 1
      if (bv == null) return -1
      if (typeof av === 'string' && typeof bv === 'string')
        return sortDir === 'desc' ? bv.localeCompare(av) : av.localeCompare(bv)
      return sortDir === 'desc' ? Number(bv) - Number(av) : Number(av) - Number(bv)
    })
  }, [coachStats, sortKey, sortDir])

  // ─── Aggregate numbers ─────────────────────────────────────────────────────
  const totLeads   = coachStats.reduce((s, c) => s + c.totalLeads, 0)
  const totReplied = coachStats.reduce((s, c) => s + c.totalReplied, 0)
  const totBooked  = coachStats.reduce((s, c) => s + c.totalBooked, 0)
  const totClosed  = coachStats.reduce((s, c) => s + c.totalClosed, 0)
  const aggReply   = totLeads   > 0 ? Math.round((totReplied / totLeads)   * 100) : null
  const aggBook    = totReplied > 0 ? Math.round((totBooked  / totReplied) * 100) : null
  const aggClose   = totBooked  > 0 ? Math.round((totClosed  / totBooked)  * 100) : null
  const totClients = coachStats.reduce((s, c) => s + c.clientsSignedThisMonth, 0)
  const emptyPipe  = coachStats.filter(c => c.totalLeads === 0).length
  const inactive   = coachStats.filter(c => {
    if (!c.lastLogin) return true
    return Date.now() - new Date(c.lastLogin).getTime() > 7 * 86400000
  }).length

  const rateAccent = (r: number | null, g: number, a: number) =>
    r === null ? 'var(--border-strong)' : r >= g ? '#16A34A' : r >= a ? '#D97706' : '#DC2626'

  const TABLE_COLS: { key: SortKey; label: string }[] = [
    { key: 'name',                   label: t.admin.coaches },
    { key: 'totalLeads',             label: t.admin.totalLeads },
    { key: 'replyRate',              label: t.admin.replyRate },
    { key: 'bookingRate',            label: t.admin.bookingRate },
    { key: 'closeRate',              label: t.admin.closeRate },
    { key: 'cashThisMonth',          label: t.admin.cashThisMonth },
    { key: 'clientsSignedThisMonth', label: t.admin.clientsSigned },
    { key: 'lastLogin',              label: t.admin.lastLogin },
  ]

  function SortArrow({ col }: { col: SortKey }) {
    if (sortKey !== col) return <span style={{ opacity: 0.25, marginLeft: 3, fontSize: 10 }}>↕</span>
    return <span style={{ marginLeft: 3, fontSize: 10 }}>{sortDir === 'desc' ? '↓' : '↑'}</span>
  }

  const TAB_BTN = (active: boolean): React.CSSProperties => ({
    padding:      '5px 16px',
    borderRadius: 6,
    fontSize:     12,
    fontWeight:   active ? 600 : 400,
    color:        active ? 'var(--text-1)' : 'var(--text-2)',
    background:   active ? 'var(--surface-1)' : 'transparent',
    border:       'none',
    cursor:       'pointer',
    boxShadow:    active ? 'var(--shadow-card)' : 'none',
    transition:   'all 120ms ease',
  })

  const VIEW_BTN: React.CSSProperties = {
    fontSize:    12,
    fontWeight:  500,
    padding:     '5px 10px',
    borderRadius: 6,
    border:      '1px solid var(--border-strong)',
    background:  'transparent',
    color:       'var(--text-2)',
    cursor:      'pointer',
    whiteSpace:  'nowrap',
    transition:  'all 120ms',
  }

  return (
    <div style={{ padding: '24px 24px 88px', maxWidth: '1100px' }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-1)', marginBottom: 4 }}>{t.admin.title}</h1>
          <p style={{ fontSize: 13, color: 'var(--text-2)' }}>
            {coachStats.length} coach{coachStats.length !== 1 ? 'es' : ''} · {fmtMonth(currentMonth)}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <a
            href="/admin/checkins"
            style={{
              fontSize: 12, fontWeight: 500,
              padding: '5px 12px',
              borderRadius: 6,
              border: '1px solid var(--border-strong)',
              background: 'transparent',
              color: 'var(--text-2)',
              textDecoration: 'none',
              transition: 'all 120ms',
            }}
          >
            {t.admin.checkins} →
          </a>
          <div style={{ display: 'flex', gap: 2, background: 'var(--surface-2)', borderRadius: 'var(--radius-btn)', padding: 3 }}>
            <button onClick={() => setTab('overview')} style={TAB_BTN(tab === 'overview')}>{t.admin.overview}</button>
            <button onClick={() => setTab('numbers')}  style={TAB_BTN(tab === 'numbers')}>{t.numbers.title}</button>
            <button onClick={() => setTab('coaches')}  style={TAB_BTN(tab === 'coaches')}>{t.admin.coaches}</button>
          </div>
        </div>
      </div>

      {/* ══ OVERVIEW TAB ═══════════════════════════════════════════════════════ */}
      {tab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

          {/* Missing check-ins alert */}
          {missingCheckins.length > 0 && (
            <a
              href="/admin/checkins"
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 16px',
                background: 'rgba(220,38,38,0.06)',
                border: '1px solid rgba(220,38,38,0.25)',
                borderLeft: '3px solid #DC2626',
                borderRadius: 'var(--radius-card)',
                textDecoration: 'none',
                transition: 'background 120ms',
              }}
            >
              <span style={{ fontSize: 16 }}>⚠️</span>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: '#DC2626', marginBottom: 2 }}>
                  {missingCheckins.length} coach{missingCheckins.length > 1 ? 'es haven\'t' : ' hasn\'t'} submitted this week&apos;s check-in
                </p>
                <p style={{ fontSize: 12, color: 'var(--text-2)' }}>
                  {missingCheckins.join(', ')}
                </p>
              </div>
              <span style={{ fontSize: 12, color: '#DC2626', fontWeight: 500, flexShrink: 0 }}>View →</span>
            </a>
          )}

          {/* Top stat row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
            <StatCard
              label="Active coaches"
              value={String(coachStats.length)}
              accent="#2563EB"
            />
            <StatCard
              label="Total pipeline leads"
              value={totLeads.toLocaleString()}
              sub="Across all coaches"
              accent="var(--border-strong)"
            />
            <StatCard
              label="Avg reply rate"
              value={aggReply !== null ? `${aggReply}%` : '—'}
              sub="Leads → replied"
              accent={rateAccent(aggReply, 15, 8)}
            />
            <StatCard
              label="Avg close rate"
              value={aggClose !== null ? `${aggClose}%` : '—'}
              sub="Booked → closed"
              accent={rateAccent(aggClose, 25, 15)}
            />
          </div>

          {/* Second stat row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
            <StatCard
              label={`Clients signed — ${fmtMonth(currentMonth)}`}
              value={String(totClients)}
              accent={totClients > 0 ? '#16A34A' : 'var(--border-strong)'}
            />
            <StatCard
              label="Avg booking rate"
              value={aggBook !== null ? `${aggBook}%` : '—'}
              sub="Replied → call booked"
              accent={rateAccent(aggBook, 30, 15)}
            />
            <StatCard
              label="Empty pipelines"
              value={String(emptyPipe)}
              sub={emptyPipe > 0 ? 'Coaches with 0 leads' : 'All coaches have leads'}
              accent={emptyPipe > 0 ? '#D97706' : '#16A34A'}
            />
            <StatCard
              label="Inactive 7+ days"
              value={String(inactive)}
              sub={inactive > 0 ? 'No login in a week' : 'All coaches active'}
              accent={inactive > 0 ? '#D97706' : '#16A34A'}
            />
          </div>

          {/* Aggregate funnel */}
          <div style={{
            background:   'var(--surface-1)',
            border:       '1px solid var(--border)',
            borderRadius: 'var(--radius-card)',
            padding:      '20px 24px',
            boxShadow:    'var(--shadow-card)',
          }}>
            <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-3)', marginBottom: 16 }}>
              {t.admin.aggregateFunnel}
            </p>
            <AggregateFunnel coaches={coachStats} />
          </div>

          {/* Team section */}
          <TeamSection teamMembers={teamMembers} todayEods={todayEods} coachStats={coachStats} />

          {/* Per-coach sortable table */}
          <div>
            <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-3)', marginBottom: 10 }}>
              Coach breakdown — click any column to sort
            </p>
            <div style={{ background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: 'var(--radius-card)', overflow: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 780 }}>
                <thead>
                  <tr style={{ background: 'var(--surface-2)' }}>
                    {TABLE_COLS.map(col => (
                      <th
                        key={col.key}
                        onClick={() => toggleSort(col.key)}
                        style={{
                          padding:       '10px 14px',
                          textAlign:     'left',
                          fontSize:      11,
                          fontWeight:    600,
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                          color:         sortKey === col.key ? 'var(--accent)' : 'var(--text-3)',
                          cursor:        'pointer',
                          whiteSpace:    'nowrap',
                          userSelect:    'none',
                          borderBottom:  '1px solid var(--border)',
                        }}
                      >
                        {col.label}<SortArrow col={col.key} />
                      </th>
                    ))}
                    <th style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)' }} />
                  </tr>
                </thead>
                <tbody>
                  {sortedCoaches.map((c, i) => {
                    const reply   = ratePill(c.replyRate,   15, 8)
                    const booking = ratePill(c.bookingRate, 30, 15)
                    const close   = ratePill(c.closeRate,   25, 15)
                    const isLast  = i === sortedCoaches.length - 1

                    return (
                      <tr
                        key={c.userId}
                        style={{ borderBottom: isLast ? 'none' : '1px solid var(--border)', transition: 'background 100ms' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLTableRowElement).style.background = 'var(--surface-2)' }}
                        onMouseLeave={e => { (e.currentTarget as HTMLTableRowElement).style.background = 'transparent' }}
                      >
                        {/* Coach */}
                        <td style={{ padding: '12px 14px' }}>
                          <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-1)' }}>{c.name}</p>
                          <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 1 }}>{c.businessName || c.currency}</p>
                        </td>

                        {/* Leads */}
                        <td style={{ padding: '12px 14px' }}>
                          <span style={{ fontSize: 13, fontWeight: 600, color: c.totalLeads > 0 ? 'var(--text-1)' : 'var(--text-3)' }}>
                            {c.totalLeads}
                          </span>
                        </td>

                        {/* Reply % */}
                        <td style={{ padding: '12px 14px' }}>
                          <span style={{ display: 'inline-block', background: reply.bg, color: reply.color, borderRadius: 4, padding: '2px 7px', fontSize: 12, fontWeight: 600 }}>
                            {reply.text}
                          </span>
                        </td>

                        {/* Book % */}
                        <td style={{ padding: '12px 14px' }}>
                          <span style={{ display: 'inline-block', background: booking.bg, color: booking.color, borderRadius: 4, padding: '2px 7px', fontSize: 12, fontWeight: 600 }}>
                            {booking.text}
                          </span>
                        </td>

                        {/* Close % */}
                        <td style={{ padding: '12px 14px' }}>
                          <span style={{ display: 'inline-block', background: close.bg, color: close.color, borderRadius: 4, padding: '2px 7px', fontSize: 12, fontWeight: 600 }}>
                            {close.text}
                          </span>
                        </td>

                        {/* Cash this month */}
                        <td style={{ padding: '12px 14px', fontSize: 13, color: c.cashThisMonth > 0 ? 'var(--text-1)' : 'var(--text-3)', whiteSpace: 'nowrap' }}>
                          {c.cashThisMonth > 0 ? `${c.currency} ${c.cashThisMonth.toLocaleString()}` : '—'}
                        </td>

                        {/* Clients this month */}
                        <td style={{ padding: '12px 14px', fontSize: 13, fontWeight: c.clientsSignedThisMonth > 0 ? 700 : 400, color: c.clientsSignedThisMonth > 0 ? '#16A34A' : 'var(--text-3)' }}>
                          {c.clientsSignedThisMonth > 0 ? `+${c.clientsSignedThisMonth}` : '0'}
                        </td>

                        {/* Last seen */}
                        <td style={{ padding: '12px 14px', fontSize: 12, color: 'var(--text-2)', whiteSpace: 'nowrap' }}>
                          {timeAgo(c.lastLogin)}
                        </td>

                        {/* View as */}
                        <td style={{ padding: '12px 14px' }}>
                          <button
                            onClick={() => handleViewAs(c.userId, c.name)}
                            disabled={loadingId === c.userId}
                            style={{ ...VIEW_BTN, opacity: loadingId === c.userId ? 0.5 : 1, cursor: loadingId === c.userId ? 'not-allowed' : 'pointer' }}
                            onMouseEnter={e => {
                              if (loadingId !== c.userId) {
                                const el = e.currentTarget as HTMLButtonElement
                                el.style.background    = 'rgba(37,99,235,0.1)'
                                el.style.color         = 'var(--accent)'
                                el.style.borderColor   = 'rgba(37,99,235,0.3)'
                              }
                            }}
                            onMouseLeave={e => {
                              const el = e.currentTarget as HTMLButtonElement
                              el.style.background  = 'transparent'
                              el.style.color       = 'var(--text-2)'
                              el.style.borderColor = 'var(--border-strong)'
                            }}
                          >
                            {loadingId === c.userId ? '…' : 'View as →'}
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                  {coachStats.length === 0 && (
                    <tr>
                      <td colSpan={9} style={{ padding: '48px 16px', textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>
                        No coaches yet. They appear here when they sign up.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* ══ NUMBERS TAB ════════════════════════════════════════════════════════ */}
      {tab === 'numbers' && (() => {
        const totActiveClients  = coachStats.reduce((s, c) => s + c.activeClients, 0)
        const totSignedMonth    = coachStats.reduce((s, c) => s + c.clientsSignedThisMonth, 0)

        function toggleNSort(key: NumbersSortKey) {
          if (nSortKey === key) setNSortDir(d => d === 'desc' ? 'asc' : 'desc')
          else { setNSortKey(key); setNSortDir('desc') }
        }

        const sortedByNumbers = [...coachStats].sort((a, b) => {
          const av = a[nSortKey], bv = b[nSortKey]
          if (av == null && bv == null) return 0
          if (av == null) return 1
          if (bv == null) return -1
          if (typeof av === 'string' && typeof bv === 'string')
            return nSortDir === 'desc' ? bv.localeCompare(av) : av.localeCompare(bv)
          return nSortDir === 'desc' ? Number(bv) - Number(av) : Number(av) - Number(bv)
        })

        function NArrow({ col }: { col: NumbersSortKey }) {
          if (nSortKey !== col) return <span style={{ opacity: 0.25, marginLeft: 3, fontSize: 10 }}>↕</span>
          return <span style={{ marginLeft: 3, fontSize: 10 }}>{nSortDir === 'desc' ? '↓' : '↑'}</span>
        }

        const NUM_COLS: { key: NumbersSortKey; label: string }[] = [
          { key: 'name',                 label: 'Coach' },
          { key: 'activeClients',        label: 'Active clients' },
          { key: 'totalContractedValue', label: 'Total value' },
          { key: 'cashThisMonth',        label: 'Cash this month' },
          { key: 'contractsThisMonth',   label: 'Contracted this month' },
          { key: 'clientsSignedThisMonth', label: 'Clients signed' },
        ]

        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Summary chips */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
              <StatCard
                label="Total active clients"
                value={String(totActiveClients)}
                sub="Across all coaches"
                accent="#16A34A"
              />
              <StatCard
                label={`Clients signed — ${fmtMonth(currentMonth)}`}
                value={String(totSignedMonth)}
                accent={totSignedMonth > 0 ? '#16A34A' : 'var(--border-strong)'}
              />
              <StatCard
                label="Coaches with 0 clients"
                value={String(coachStats.filter(c => c.activeClients === 0).length)}
                accent={coachStats.filter(c => c.activeClients === 0).length > 0 ? '#D97706' : '#16A34A'}
                sub="Needs attention"
              />
            </div>

            {/* Per-coach numbers table */}
            <div>
              <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-3)', marginBottom: 10 }}>
                Per-coach breakdown — click any column to sort
              </p>
              <div style={{ background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: 'var(--radius-card)', overflow: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
                  <thead>
                    <tr style={{ background: 'var(--surface-2)' }}>
                      {NUM_COLS.map(col => (
                        <th
                          key={col.key}
                          onClick={() => toggleNSort(col.key)}
                          style={{
                            padding: '10px 14px', textAlign: 'left',
                            fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
                            letterSpacing: '0.05em', cursor: 'pointer', userSelect: 'none',
                            color: nSortKey === col.key ? 'var(--accent)' : 'var(--text-3)',
                            whiteSpace: 'nowrap', borderBottom: '1px solid var(--border)',
                          }}
                        >
                          {col.label}<NArrow col={col.key} />
                        </th>
                      ))}
                      <th style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)' }} />
                    </tr>
                  </thead>
                  <tbody>
                    {sortedByNumbers.map((c, i) => {
                      const isLast = i === sortedByNumbers.length - 1
                      const noClients = c.activeClients === 0
                      return (
                        <tr
                          key={c.userId}
                          style={{ borderBottom: isLast ? 'none' : '1px solid var(--border)', transition: 'background 100ms' }}
                          onMouseEnter={e => { (e.currentTarget as HTMLTableRowElement).style.background = 'var(--surface-2)' }}
                          onMouseLeave={e => { (e.currentTarget as HTMLTableRowElement).style.background = 'transparent' }}
                        >
                          {/* Coach */}
                          <td style={{ padding: '12px 14px' }}>
                            <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-1)' }}>{c.name}</p>
                            <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 1 }}>{c.currency}</p>
                          </td>

                          {/* Active clients */}
                          <td style={{ padding: '12px 14px' }}>
                            <span style={{
                              display: 'inline-flex', alignItems: 'center', gap: 5,
                              fontSize: 20, fontWeight: 700, color: noClients ? 'var(--text-3)' : 'var(--text-1)',
                            }}>
                              {c.activeClients}
                              {noClients && (
                                <span style={{ fontSize: 10, fontWeight: 600, color: '#D97706', background: 'rgba(217,119,6,0.1)', borderRadius: 4, padding: '2px 5px' }}>
                                  ⚠ None
                                </span>
                              )}
                            </span>
                          </td>

                          {/* Total contracted value */}
                          <td style={{ padding: '12px 14px', fontSize: 13, color: c.totalContractedValue > 0 ? 'var(--text-1)' : 'var(--text-3)', fontWeight: 600, whiteSpace: 'nowrap' }}>
                            {c.totalContractedValue > 0 ? `${c.currency} ${c.totalContractedValue.toLocaleString()}` : '—'}
                          </td>

                          {/* Cash this month */}
                          <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                            <p style={{ fontSize: 14, fontWeight: 700, color: c.cashThisMonth > 0 ? '#16A34A' : 'var(--text-3)' }}>
                              {c.cashThisMonth > 0 ? `${c.currency} ${c.cashThisMonth.toLocaleString()}` : '—'}
                            </p>
                          </td>

                          {/* Contracted this month */}
                          <td style={{ padding: '12px 14px', fontSize: 13, color: c.contractsThisMonth > 0 ? 'var(--text-1)' : 'var(--text-3)', whiteSpace: 'nowrap' }}>
                            {c.contractsThisMonth > 0 ? `${c.currency} ${c.contractsThisMonth.toLocaleString()}` : '—'}
                          </td>

                          {/* Clients signed this month */}
                          <td style={{ padding: '12px 14px', fontSize: 13, fontWeight: c.clientsSignedThisMonth > 0 ? 700 : 400, color: c.clientsSignedThisMonth > 0 ? '#16A34A' : 'var(--text-3)' }}>
                            {c.clientsSignedThisMonth > 0 ? `+${c.clientsSignedThisMonth}` : '0'}
                          </td>

                          {/* View as */}
                          <td style={{ padding: '12px 14px' }}>
                            <button
                              onClick={() => handleViewAs(c.userId, c.name)}
                              disabled={loadingId === c.userId}
                              style={{ ...VIEW_BTN, opacity: loadingId === c.userId ? 0.5 : 1, cursor: loadingId === c.userId ? 'not-allowed' : 'pointer' }}
                              onMouseEnter={e => {
                                if (loadingId !== c.userId) {
                                  const el = e.currentTarget as HTMLButtonElement
                                  el.style.background  = 'rgba(37,99,235,0.1)'
                                  el.style.color       = 'var(--accent)'
                                  el.style.borderColor = 'rgba(37,99,235,0.3)'
                                }
                              }}
                              onMouseLeave={e => {
                                const el = e.currentTarget as HTMLButtonElement
                                el.style.background  = 'transparent'
                                el.style.color       = 'var(--text-2)'
                                el.style.borderColor = 'var(--border-strong)'
                              }}
                            >
                              {loadingId === c.userId ? '…' : 'View as →'}
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )
      })()}

      {/* ══ COACHES TAB ════════════════════════════════════════════════════════ */}
      {tab === 'coaches' && (
        <div style={{ background: 'var(--surface-1)', borderRadius: 'var(--radius-card)', border: '1px solid var(--border)', overflow: 'hidden' }}>

          {/* Header row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 80px 90px 80px 110px', padding: '10px 16px', borderBottom: '1px solid var(--border)', background: 'var(--surface-2)' }}>
            {['Coach', 'Business', 'Clients', 'Leads', 'Last login', ''].map(h => (
              <span key={h} style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {h}
              </span>
            ))}
          </div>

          {coachStats.length === 0 ? (
            <div style={{ padding: '48px 16px', textAlign: 'center', color: 'var(--text-2)', fontSize: 13 }}>
              No coaches yet. Coaches appear here when they sign up.
            </div>
          ) : (
            coachStats.map((c, i) => (
              <div
                key={c.userId}
                style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 80px 90px 80px 110px', padding: '14px 16px', alignItems: 'center', borderBottom: i < coachStats.length - 1 ? '1px solid var(--border)' : 'none', transition: 'background 100ms' }}
                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = 'var(--surface-2)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = 'transparent' }}
              >
                <div>
                  <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-1)' }}>{c.name}</p>
                  <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 1 }}>{c.currency}</p>
                </div>
                <p style={{ fontSize: 12, color: 'var(--text-2)' }}>{c.businessName || '—'}</p>
                <p style={{ fontSize: 13, fontWeight: 600, color: c.activeClients > 0 ? 'var(--text-1)' : 'var(--text-3)' }}>
                  {c.activeClients}
                </p>
                <p style={{ fontSize: 13, color: c.totalLeads > 0 ? 'var(--text-1)' : 'var(--text-3)' }}>
                  {c.totalLeads}
                </p>
                <p style={{ fontSize: 12, color: 'var(--text-2)' }}>{timeAgo(c.lastLogin)}</p>
                <button
                  onClick={() => handleViewAs(c.userId, c.name)}
                  disabled={loadingId === c.userId}
                  style={{ ...VIEW_BTN, opacity: loadingId === c.userId ? 0.5 : 1, cursor: loadingId === c.userId ? 'not-allowed' : 'pointer' }}
                  onMouseEnter={e => {
                    if (loadingId !== c.userId) {
                      const el = e.currentTarget as HTMLButtonElement
                      el.style.background  = 'rgba(37,99,235,0.1)'
                      el.style.color       = 'var(--accent)'
                      el.style.borderColor = 'rgba(37,99,235,0.3)'
                    }
                  }}
                  onMouseLeave={e => {
                    const el = e.currentTarget as HTMLButtonElement
                    el.style.background  = 'transparent'
                    el.style.color       = 'var(--text-2)'
                    el.style.borderColor = 'var(--border-strong)'
                  }}
                >
                  {loadingId === c.userId ? 'Loading…' : 'View as →'}
                </button>
              </div>
            ))
          )}
        </div>
      )}

    </div>
  )
}
