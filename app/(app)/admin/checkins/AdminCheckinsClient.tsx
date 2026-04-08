'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { CoachCheckinStats } from './page'
import type { WeeklyCheckin } from '@/types'

interface Props {
  stats: CoachCheckinStats[]
  thisWeekStart: string
  lastWeekStart: string
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en', { month: 'short', day: 'numeric' })
}

function WeekStatus({ checkin }: { checkin: WeeklyCheckin | null }) {
  if (!checkin) {
    return <span style={{ fontSize: 13, color: '#DC2626' }}>❌ Missing</span>
  }
  if (checkin.submitted_at) {
    return <span style={{ fontSize: 13, color: '#16A34A' }}>✅ Done</span>
  }
  if (checkin.snoozed_until && new Date(checkin.snoozed_until) > new Date()) {
    return <span style={{ fontSize: 13, color: '#D97706' }}>💤 Snoozed</span>
  }
  return <span style={{ fontSize: 13, color: '#D97706' }}>⏳ Pending</span>
}

function HappinessBadge({ value }: { value: number | null }) {
  if (value === null) return <span style={{ fontSize: 13, color: 'var(--text-3)' }}>—</span>
  const color = value <= 3 ? '#DC2626' : value <= 6 ? '#D97706' : value <= 8 ? '#16A34A' : 'var(--accent)'
  return (
    <span style={{
      fontSize: 13, fontWeight: 700, color,
      background: `${color}18`,
      padding: '2px 8px', borderRadius: 99,
    }}>
      {value} / 10
    </span>
  )
}

export default function AdminCheckinsClient({ stats, thisWeekStart, lastWeekStart }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null)

  const submittedThisWeek = stats.filter(s => s.thisWeek?.submitted_at).length
  const overdueThisWeek = stats.filter(s => !s.thisWeek?.submitted_at).length
  const allHappiness = stats.map(s => s.avgHappiness).filter((v): v is number => v !== null)
  const overallAvgHappiness = allHappiness.length > 0
    ? (allHappiness.reduce((a, b) => a + b, 0) / allHappiness.length).toFixed(1)
    : null

  const formatWeekLabel = (start: string) => {
    const d = new Date(start + 'T00:00:00Z')
    return d.toLocaleDateString('en', { month: 'short', day: 'numeric', timeZone: 'UTC' })
  }

  return (
    <div style={{ padding: '24px', maxWidth: 960, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, paddingBottom: 16, borderBottom: '1px solid var(--border)' }}>
        <div>
          <Link href="/admin" style={{ fontSize: 12, color: 'var(--text-3)', textDecoration: 'none', display: 'block', marginBottom: 4 }}>
            ← Admin
          </Link>
          <h1 className="page-title">Check-in Overview</h1>
        </div>
        <span style={{ fontSize: 13, color: 'var(--text-2)' }}>
          Week of {formatWeekLabel(thisWeekStart)}
        </span>
      </div>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
        {[
          {
            label: 'Submitted this week',
            value: `${submittedThisWeek} / ${stats.length}`,
            color: submittedThisWeek === stats.length ? '#16A34A' : submittedThisWeek > stats.length / 2 ? '#D97706' : '#DC2626',
          },
          {
            label: 'Avg happiness',
            value: overallAvgHappiness ? `${overallAvgHappiness} / 10` : '—',
            color: 'var(--accent)',
          },
          {
            label: 'Overdue',
            value: String(overdueThisWeek),
            color: overdueThisWeek > 0 ? '#DC2626' : '#16A34A',
          },
        ].map(card => (
          <div
            key={card.label}
            style={{
              background: 'var(--surface-1)',
              border: '1px solid var(--border)',
              borderLeft: `3px solid ${card.color}`,
              borderRadius: 'var(--radius-card)',
              padding: '14px 16px',
              boxShadow: 'var(--shadow-card)',
            }}
          >
            <p className="label-caps" style={{ marginBottom: 6 }}>{card.label}</p>
            <p className="hero-num" style={{ color: card.color }}>{card.value}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div style={{
        background: 'var(--surface-1)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-card)',
        boxShadow: 'var(--shadow-card)',
        overflow: 'hidden',
      }}>
        {/* Table header */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 100px 100px 80px 100px 120px',
          gap: 8,
          padding: '10px 16px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--surface-2)',
        }}>
          {['Name', 'This week', 'Last week', 'Streak', 'Avg mood', 'Last submitted'].map(h => (
            <p key={h} className="label-caps">{h}</p>
          ))}
        </div>

        {stats.length === 0 && (
          <div style={{ padding: '32px', textAlign: 'center' }}>
            <p style={{ fontSize: 13, color: 'var(--text-2)' }}>No coaches found.</p>
          </div>
        )}

        {stats.map(coach => {
          const isExpanded = expanded === coach.userId
          return (
            <div key={coach.userId} style={{ borderBottom: '1px solid var(--border)' }}>
              {/* Row */}
              <button
                onClick={() => setExpanded(isExpanded ? null : coach.userId)}
                style={{
                  width: '100%', background: 'none', border: 'none',
                  cursor: 'pointer', textAlign: 'left', padding: '0',
                }}
              >
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 100px 100px 80px 100px 120px',
                  gap: 8, padding: '12px 16px',
                  alignItems: 'center',
                  background: isExpanded ? 'var(--surface-2)' : 'transparent',
                  transition: 'background 120ms ease',
                }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)' }}>{coach.name}</p>
                  <WeekStatus checkin={coach.thisWeek} />
                  <WeekStatus checkin={coach.lastWeek} />
                  <p style={{ fontSize: 13, color: 'var(--text-2)' }}>
                    {coach.streak > 0 ? `🔥 ${coach.streak}wk` : '—'}
                  </p>
                  <HappinessBadge value={coach.avgHappiness} />
                  <p style={{ fontSize: 12, color: 'var(--text-3)' }}>{formatDate(coach.lastSubmitted)}</p>
                </div>
              </button>

              {/* Expanded — last check-in details */}
              {isExpanded && coach.thisWeek?.submitted_at && (
                <div style={{
                  padding: '12px 16px 16px',
                  background: 'var(--surface-2)',
                  borderTop: '1px solid var(--border)',
                }}>
                  <p className="label-caps" style={{ marginBottom: 10 }}>This week&apos;s check-in</p>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                    {[
                      { label: '🏆 Biggest win', value: coach.thisWeek.biggest_win },
                      { label: '🎯 Main focus', value: coach.thisWeek.main_focus },
                      { label: '🤝 Support needed', value: coach.thisWeek.support_needed },
                      { label: '📝 Week summary', value: coach.thisWeek.week_summary },
                    ].filter(f => f.value).map(f => (
                      <div key={f.label} style={{
                        background: 'var(--surface-1)',
                        borderRadius: 8, padding: '10px 12px',
                        border: '1px solid var(--border)',
                      }}>
                        <p style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 4 }}>{f.label}</p>
                        <p style={{ fontSize: 13, color: 'var(--text-1)', lineHeight: 1.5 }}>{f.value}</p>
                      </div>
                    ))}
                  </div>
                  {/* Numbers */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 8 }}>
                    {[
                      { label: 'Followers', value: coach.thisWeek.followers_gained },
                      { label: 'Replies', value: coach.thisWeek.replies_received },
                      { label: 'Calls booked', value: coach.thisWeek.calls_booked },
                      { label: 'Clients closed', value: coach.thisWeek.clients_closed },
                      { label: 'Happiness', value: coach.thisWeek.happiness_rating ? `${coach.thisWeek.happiness_rating}/10` : null },
                    ].filter(r => r.value !== null).map(row => (
                      <div key={row.label} style={{
                        background: 'var(--surface-1)',
                        borderRadius: 8, padding: '8px 12px',
                        border: '1px solid var(--border)',
                      }}>
                        <p style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 2 }}>{row.label}</p>
                        <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-1)' }}>{row.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {isExpanded && !coach.thisWeek?.submitted_at && (
                <div style={{
                  padding: '12px 16px',
                  background: 'var(--surface-2)',
                  borderTop: '1px solid var(--border)',
                }}>
                  <p style={{ fontSize: 13, color: 'var(--text-3)' }}>
                    No submitted check-in for this week yet.
                  </p>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
