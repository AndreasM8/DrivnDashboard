'use client'

import { useEffect, useState } from 'react'
import type { TeamMember } from '@/types'
import type { EodReportRow, NonnegCompletion, PerformanceResponse } from '@/app/api/team/performance/route'

interface Props {
  members: TeamMember[]
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00')
  const now = new Date()
  const todayStr = now.toISOString().slice(0, 10)
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayStr = yesterday.toISOString().slice(0, 10)

  if (dateStr === todayStr) return 'Today'
  if (dateStr === yesterdayStr) return 'Yesterday'

  const diffDays = Math.floor((now.getTime() - date.getTime()) / 86400000)
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

function getLast7Days(): string[] {
  const days: string[] = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    days.push(d.toISOString().slice(0, 10))
  }
  return days
}

const SHORT_DAY = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

function dayLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return SHORT_DAY[d.getDay()]
}

// ─── Metric detection ─────────────────────────────────────────────────────────

interface Metric {
  label: string
  value: number
}

function detectMetrics(reports: EodReportRow[]): Metric[] {
  const acc: Record<string, { label: string; value: number }> = {}

  function addTo(key: string, label: string, raw: string) {
    const n = parseFloat(raw)
    if (!isNaN(n) && n >= 0) {
      if (!acc[key]) acc[key] = { label, value: 0 }
      acc[key].value += n
    }
  }

  for (const report of reports) {
    for (const ans of report.answers) {
      const lbl = (ans.label ?? '').toLowerCase()
      const val = String(ans.value ?? '')

      if (lbl.includes('follow') && lbl.includes('new')) {
        addTo('new_followers', 'New followers', val)
      } else if (lbl.includes('follow')) {
        addTo('followups', 'Followups', val)
      }

      if (lbl.includes('offer')) addTo('offers', 'Offers sent', val)

      if (lbl.includes('book') || lbl.includes('booked')) {
        addTo('calls_booked', 'Calls booked', val)
      }

      if (lbl.includes('call') && (lbl.includes('taken') || lbl.includes('today'))) {
        addTo('calls_taken', 'Calls taken', val)
      }

      if (lbl.includes('clos') || lbl.includes('deal')) {
        addTo('deals_closed', 'Deals closed', val)
      }

      if (lbl.includes('repl')) addTo('replies', 'Replies', val)
    }
  }

  return Object.values(acc)
    .filter(m => m.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 4)
}

// ─── Non-neg streak ───────────────────────────────────────────────────────────

function calcStreak(
  memberId: string,
  completions: NonnegCompletion[],
  totalNonNegs: number,
): number {
  if (totalNonNegs === 0) return 0
  const memberCompletions = completions.filter(c => c.team_member_id === memberId)

  // Group by date
  const byDate: Record<string, Set<string>> = {}
  for (const c of memberCompletions) {
    if (!byDate[c.date]) byDate[c.date] = new Set()
    byDate[c.date].add(c.non_neg_id)
  }

  let streak = 0
  const today = new Date()
  for (let i = 0; i < 60; i++) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const dateStr = d.toISOString().slice(0, 10)
    const completed = byDate[dateStr]?.size ?? 0
    if (completed >= totalNonNegs) {
      streak++
    } else {
      break
    }
  }
  return streak
}

// ─── 7-day bar chart ──────────────────────────────────────────────────────────

interface DayBar {
  date: string
  pct: number | null
}

function buildBars(
  memberId: string,
  completions: NonnegCompletion[],
  totalNonNegs: number,
): DayBar[] {
  const days = getLast7Days()
  if (totalNonNegs === 0) return days.map(d => ({ date: d, pct: null }))

  const byDate: Record<string, number> = {}
  for (const c of completions) {
    if (c.team_member_id === memberId) {
      byDate[c.date] = (byDate[c.date] ?? 0) + 1
    }
  }

  return days.map(d => {
    const count = byDate[d]
    if (count === undefined) return { date: d, pct: null }
    return { date: d, pct: Math.min(100, Math.round((count / totalNonNegs) * 100)) }
  })
}

function barColor(pct: number | null): string {
  if (pct === null) return 'var(--border)'
  if (pct >= 100) return '#10B981'
  if (pct > 50) return '#F59E0B'
  return '#EF4444'
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {[1, 2].map(i => (
        <div key={i} style={{ background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: 'var(--radius-card)', padding: 20 }}>
          <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
            <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--surface-2)', flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ height: 14, width: 120, background: 'var(--surface-2)', borderRadius: 6, marginBottom: 8 }} />
              <div style={{ height: 12, width: 80, background: 'var(--surface-2)', borderRadius: 6 }} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end', height: 60, marginBottom: 12 }}>
            {[1, 2, 3, 4, 5, 6, 7].map(j => (
              <div key={j} style={{ flex: 1, background: 'var(--surface-2)', borderRadius: 4, height: `${20 + j * 5}%` }} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── EOD Table ────────────────────────────────────────────────────────────────

function EodTable({ reports }: { reports: EodReportRow[] }) {
  if (reports.length === 0) {
    return <p style={{ fontSize: 13, color: 'var(--text-3)', textAlign: 'center', padding: '20px 0' }}>No EOD reports yet.</p>
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', padding: '6px 8px', color: 'var(--text-3)', fontWeight: 600, borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>Date</th>
            <th style={{ textAlign: 'left', padding: '6px 8px', color: 'var(--text-3)', fontWeight: 600, borderBottom: '1px solid var(--border)' }}>Answers</th>
          </tr>
        </thead>
        <tbody>
          {reports.map(r => (
            <tr key={r.id} style={{ borderBottom: '1px solid var(--border)' }}>
              <td style={{ padding: '8px 8px', color: 'var(--text-2)', whiteSpace: 'nowrap', verticalAlign: 'top' }}>
                {formatRelativeDate(r.date)}
              </td>
              <td style={{ padding: '8px 8px', verticalAlign: 'top' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {r.answers.slice(0, 3).map(a => (
                    <span
                      key={a.question_id}
                      style={{
                        fontSize: 11, padding: '2px 7px', borderRadius: 5,
                        background: 'var(--surface-2)', border: '1px solid var(--border)',
                        color: 'var(--text-1)',
                      }}
                    >
                      {a.label}: <strong>{a.value}</strong>
                    </span>
                  ))}
                  {r.answers.length > 3 && (
                    <span style={{ fontSize: 11, color: 'var(--text-3)', padding: '2px 4px' }}>+{r.answers.length - 3} more</span>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── Member Performance Card ──────────────────────────────────────────────────

interface MemberCardProps {
  member: TeamMember
  eodReports: EodReportRow[]
  completions: NonnegCompletion[]
  totalNonNegs: number
}

function MemberPerformanceCard({ member, eodReports, completions, totalNonNegs }: MemberCardProps) {
  const [showEods, setShowEods] = useState(false)

  const last7Days = getLast7Days()
  const reportsLast7 = eodReports.filter(r => last7Days.includes(r.date))
  const latestEod = eodReports[0]
  const streak = calcStreak(member.id, completions, totalNonNegs)
  const bars = buildBars(member.id, completions, totalNonNegs)
  const metrics = detectMetrics(reportsLast7)

  const roleColor = member.role === 'setter' ? '#7C3AED' : '#2563EB'
  const roleBg = member.role === 'setter' ? 'rgba(124,58,237,0.1)' : 'rgba(37,99,235,0.1)'

  return (
    <div style={{ background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: 'var(--radius-card)', padding: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 16 }}>
        <div style={{
          width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
          background: roleBg, color: roleColor,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 16, fontWeight: 700,
        }}>
          {member.name.charAt(0).toUpperCase()}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 2 }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-1)' }}>{member.name}</span>
            <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 5, background: roleBg, color: roleColor, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {member.role}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, color: 'var(--text-2)' }}>
              Last EOD: <strong style={{ color: 'var(--text-1)' }}>{latestEod ? formatRelativeDate(latestEod.date) : 'Never'}</strong>
            </span>
            {totalNonNegs > 0 && (
              <span style={{ fontSize: 12, color: 'var(--text-2)' }}>
                Streak: <strong style={{ color: streak >= 3 ? '#10B981' : streak >= 1 ? '#F59E0B' : 'var(--text-1)' }}>{streak}d</strong>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 7-day non-neg bar chart */}
      {totalNonNegs > 0 ? (
        <div style={{ marginBottom: 16 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
            Non-negs — last 7 days
          </p>
          <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end', height: 56 }}>
            {bars.map(bar => (
              <div key={bar.date} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <div style={{ width: '100%', display: 'flex', alignItems: 'flex-end', height: 44 }}>
                  <div
                    style={{
                      width: '100%',
                      height: `${bar.pct !== null ? Math.max(8, bar.pct) : 8}%`,
                      background: barColor(bar.pct),
                      borderRadius: 3,
                      opacity: bar.pct === null ? 0.25 : 1,
                      transition: 'height 300ms',
                    }}
                    title={bar.pct !== null ? `${bar.pct}%` : 'No data'}
                  />
                </div>
                <span style={{ fontSize: 9, color: 'var(--text-3)', fontWeight: 600 }}>{dayLabel(bar.date)}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div style={{ marginBottom: 16, padding: '10px 14px', background: 'var(--surface-2)', borderRadius: 8, fontSize: 12, color: 'var(--text-3)' }}>
          No non-negotiables configured.
        </div>
      )}

      {/* EOD key metrics */}
      {metrics.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
            7-day totals
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {metrics.map(m => (
              <div
                key={m.label}
                style={{
                  padding: '6px 12px', borderRadius: 8,
                  background: 'var(--surface-2)', border: '1px solid var(--border)',
                }}
              >
                <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{m.label}</span>
                <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-1)', display: 'block' }}>{m.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* View all EODs toggle */}
      <button
        onClick={() => setShowEods(e => !e)}
        style={{
          width: '100%', padding: '8px 0', background: 'none',
          border: '1px solid var(--border)', borderRadius: 8,
          fontSize: 12, fontWeight: 600, color: 'var(--text-2)',
          cursor: 'pointer', marginBottom: showEods ? 12 : 0,
        }}
      >
        {showEods ? 'Hide EODs' : `View all EODs (${eodReports.length})`}
      </button>

      {showEods && <EodTable reports={eodReports} />}
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function TeamDashboard({ members }: Props) {
  const [data, setData] = useState<PerformanceResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/team/performance?days=30')
      .then(r => r.json())
      .then((json: PerformanceResponse & { error?: string }) => {
        if (json.error) { setError(json.error); return }
        setData(json)
      })
      .catch(() => setError('Failed to load performance data'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <Skeleton />
  if (error) return (
    <div style={{ padding: 24, textAlign: 'center', color: '#EF4444', fontSize: 14 }}>
      {error}
    </div>
  )
  if (!data || data.members.length === 0) return (
    <div style={{ padding: 40, textAlign: 'center', background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: 'var(--radius-card)' }}>
      <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-1)', marginBottom: 4 }}>No active team members</p>
      <p style={{ fontSize: 13, color: 'var(--text-2)', margin: 0 }}>Switch to the Members tab to add or activate team members.</p>
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {data.members.map(member => {
        const memberReports = data.eodReports.filter(r => r.team_member_id === member.id)
        const totalNonNegs = data.nonnegCounts[member.id] ?? 0
        return (
          <MemberPerformanceCard
            key={member.id}
            member={member}
            eodReports={memberReports}
            completions={data.nonnegCompletions}
            totalNonNegs={totalNonNegs}
          />
        )
      })}
    </div>
  )
}
