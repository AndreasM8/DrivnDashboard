'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type {
  TeamMember, TeamNonNeg, TeamTask, TeamPersonalTask,
  CheckinQuestion, MemberKpiTargets,
} from '@/types'

// ── Types ───────────────────────────────────────────────────────────────────

type AnswerMap = Record<string, string | number | boolean>
type EodAnswer = { question_id: string; value: string | number | boolean }
type EodReport = { date: string; submitted_at: string; answers: EodAnswer[] }
type Period = 'today' | 'week' | 'month'
type ViewMode = 'live' | 'targets'

interface RawMetrics {
  followers: number
  replies: number
  followups: number
  calls_booked: number
  offers: number
  sales: number
  revenue: number
  calls_taken: number
  no_shows: number
}

interface Metrics extends RawMetrics {
  showed: number
  response_rate: number | null   // %
  booking_rate: number | null    // %
  show_rate: number | null       // %
  offer_rate: number | null      // %
  close_rate: number | null      // %
}

interface Props {
  member: TeamMember
  nonNegs: TeamNonNeg[]
  completedNonNegIds: string[]
  totalNonNegs: number
  completedNonNegs: number
  openTeamTasks: TeamTask[]
  openPersonalTasks: TeamPersonalTask[]
  eodSubmitted: boolean
  eodQuestions: CheckinQuestion[]
  eodAnswers: EodAnswer[]
  eodHistory: EodReport[]
  today: string
  streak: number
}

// ── Metric extraction ───────────────────────────────────────────────────────

function labelToKey(label: string): keyof RawMetrics | null {
  const l = label.toLowerCase()
  // Order matters — check specific combos first
  if (l.includes('no-show') || l.includes('noshow') || (l.includes('no') && l.includes('show'))) return 'no_shows'
  if (l.includes('follower')) return 'followers'
  if (l.includes('followup') || l.includes('follow-up') || (l.includes('follow') && l.includes('lead'))) return 'followups'
  if (l.includes('repl')) return 'replies'
  if (l.includes('booked') || l.includes('meetings booked')) return 'calls_booked'
  if (l.includes('calls taken') || (l.includes('calls') && l.includes('today'))) return 'calls_taken'
  if (l.includes('offer') && !l.includes('rate') && !l.includes('%')) return 'offers'
  if (l.includes('deal') || (l.includes('sales') && !l.includes('call'))) return 'sales'
  if (l.includes('revenue') || l.includes('cash')) return 'revenue'
  return null
}

function aggregateReports(reports: EodReport[], questions: CheckinQuestion[]): RawMetrics {
  const totals: RawMetrics = {
    followers: 0, replies: 0, followups: 0, calls_booked: 0,
    offers: 0, sales: 0, revenue: 0, calls_taken: 0, no_shows: 0,
  }
  const qMap = new Map(questions.map(q => [q.id, q]))
  for (const report of reports) {
    for (const ans of report.answers) {
      const q = qMap.get(ans.question_id)
      if (!q || q.type !== 'number') continue
      const key = labelToKey(q.label)
      if (!key) continue
      const val = Number(ans.value)
      if (!isNaN(val) && val >= 0) totals[key] += val
    }
  }
  return totals
}

function deriveMetrics(raw: RawMetrics): Metrics {
  const showed = Math.max(0, raw.calls_taken - raw.no_shows)
  const pct = (num: number, den: number) => den > 0 ? Math.round((num / den) * 100) : null
  return {
    ...raw,
    showed,
    response_rate: pct(raw.replies, raw.followers),
    booking_rate: pct(raw.calls_booked, raw.replies),
    show_rate: pct(showed, raw.calls_taken),
    offer_rate: showed > 0 ? pct(raw.offers, showed) : null,
    close_rate: raw.offers > 0 ? pct(raw.sales, raw.offers) : showed > 0 ? pct(raw.sales, showed) : null,
  }
}

function filterByPeriod(history: EodReport[], period: Period, today: string): EodReport[] {
  if (period === 'today') return history.filter(r => r.date === today)
  if (period === 'week') {
    const d = new Date(today)
    const dayOfWeek = d.getDay()                      // 0=Sun
    const daysFromMon = dayOfWeek === 0 ? 6 : dayOfWeek - 1
    const weekStart = new Date(d)
    weekStart.setDate(d.getDate() - daysFromMon)
    const ws = weekStart.toISOString().slice(0, 10)
    return history.filter(r => r.date >= ws && r.date <= today)
  }
  const monthStart = today.slice(0, 7) + '-01'
  return history.filter(r => r.date >= monthStart && r.date <= today)
}

// ── Styling helpers ─────────────────────────────────────────────────────────

const CARD: React.CSSProperties = {
  background: 'var(--surface-1)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-card)',
}

// Key metrics turn red at 0 — anything the user should never leave at 0
function isKeyMetric(key: string): boolean {
  return ['calls_booked', 'calls_taken', 'sales', 'deals', 'showed'].includes(key)
}

function numColor(val: number | null, key: string): string {
  if (val === null) return 'var(--text-3)'
  if (val > 0) return '#10B981'
  if (isKeyMetric(key)) return '#EF4444'
  return '#F59E0B'
}

function numBg(val: number | null, key: string): string {
  if (val === null || val === 0) {
    if (isKeyMetric(key)) return 'rgba(239,68,68,0.07)'
    return 'var(--surface-2)'
  }
  return 'rgba(16,185,129,0.07)'
}

function numBorder(val: number | null, key: string): string {
  if (val === null || val === 0) {
    if (isKeyMetric(key)) return 'rgba(239,68,68,0.2)'
    return 'var(--border)'
  }
  return 'rgba(16,185,129,0.2)'
}

function rateColor(val: number | null): string {
  if (val === null) return 'var(--text-3)'
  if (val >= 70) return '#10B981'
  if (val >= 40) return '#F59E0B'
  return '#EF4444'
}

// ── Sub-components ──────────────────────────────────────────────────────────

function KpiTile({
  label, value, unit = '', isRate = false, metricKey = '',
}: {
  label: string
  value: number | null
  unit?: string
  isRate?: boolean
  metricKey?: string
}) {
  const display = value === null ? '–' : isRate
    ? `${value}%`
    : unit === '$' ? `$${value.toLocaleString()}` : String(value)

  const color = isRate ? rateColor(value) : numColor(value, metricKey)
  const bg = isRate ? 'var(--surface-2)' : numBg(value, metricKey)
  const border = isRate ? 'var(--border)' : numBorder(value, metricKey)

  return (
    <div style={{
      background: bg,
      border: `1px solid ${border}`,
      borderRadius: 10,
      padding: '14px 14px 12px',
    }}>
      <p style={{
        fontSize: 22, fontWeight: 800, color,
        margin: '0 0 4px', lineHeight: 1,
      }}>
        {display}
      </p>
      <p style={{
        fontSize: 10, fontWeight: 600,
        color: 'var(--text-2)', margin: 0,
        textTransform: 'uppercase', letterSpacing: '0.05em', lineHeight: 1.3,
      }}>
        {label}
      </p>
    </div>
  )
}

function TargetTile({
  label, value, actual, unit = '', isRate = false,
}: {
  label: string
  value: number | undefined
  actual: number | null
  unit?: string
  isRate?: boolean
}) {
  const fmt = (n: number) => isRate ? `${n}%` : unit === '$' ? `$${n.toLocaleString()}` : String(n)
  const pct = value && value > 0 && actual !== null
    ? Math.min(Math.round((actual / value) * 100), 999)
    : null
  const barColor = pct === null ? '#6B7280' : pct >= 100 ? '#10B981' : pct >= 50 ? '#F59E0B' : '#EF4444'

  return (
    <div style={{
      background: 'var(--surface-2)',
      border: '1px solid var(--border)',
      borderRadius: 10,
      padding: '14px 14px 12px',
    }}>
      <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-2)', margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}
      </p>
      <p style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-1)', margin: '0 0 6px', lineHeight: 1 }}>
        {value !== undefined ? fmt(value) : '–'}
      </p>
      {value !== undefined && actual !== null && (
        <>
          <div style={{ height: 4, background: 'var(--border)', borderRadius: 99, overflow: 'hidden', marginBottom: 4 }}>
            <div style={{ height: '100%', width: `${Math.min(pct ?? 0, 100)}%`, background: barColor, borderRadius: 99, transition: 'width 300ms' }} />
          </div>
          <p style={{ fontSize: 11, color: barColor, fontWeight: 600, margin: 0 }}>
            {actual !== null ? fmt(actual) : '–'} / {fmt(value)} {pct !== null && `(${pct}%)`}
          </p>
        </>
      )}
      {value === undefined && (
        <p style={{ fontSize: 11, color: 'var(--text-3)', margin: 0 }}>Not set</p>
      )}
    </div>
  )
}

// ── Role-specific KPI grids ─────────────────────────────────────────────────

function SetterKpis({ m, mode, targets }: { m: Metrics; mode: ViewMode; targets: MemberKpiTargets }) {
  if (mode === 'targets') {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 10 }}>
        <TargetTile label="Followers" value={targets.followers} actual={m.followers} />
        <TargetTile label="Responses" value={targets.replies} actual={m.replies} />
        <TargetTile label="Response Rate" value={targets.response_rate} actual={m.response_rate} isRate />
        <TargetTile label="Meetings Booked" value={targets.calls_booked} actual={m.calls_booked} />
        <TargetTile label="Booking Rate" value={targets.booking_rate} actual={m.booking_rate} isRate />
        <TargetTile label="Show Rate" value={targets.show_rate} actual={m.show_rate} isRate />
        <TargetTile label="Follow-ups" value={targets.followups} actual={m.followups} />
        <TargetTile label="Sales" value={targets.sales} actual={m.sales} />
        <TargetTile label="Revenue" value={targets.revenue} actual={m.revenue} unit="$" />
      </div>
    )
  }
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 10 }}>
      <KpiTile label="Followers" value={m.followers} metricKey="followers" />
      <KpiTile label="Responses" value={m.replies} metricKey="replies" />
      <KpiTile label="Response Rate" value={m.response_rate} isRate />
      <KpiTile label="Meetings Booked" value={m.calls_booked} metricKey="calls_booked" />
      <KpiTile label="Booking Rate" value={m.booking_rate} isRate />
      <KpiTile label="Follow-ups" value={m.followups} metricKey="followups" />
      <KpiTile label="Sales" value={m.sales} metricKey="sales" />
      <KpiTile label="Revenue" value={m.revenue} metricKey="revenue" unit="$" />
    </div>
  )
}

function CloserKpis({ m, mode, targets }: { m: Metrics; mode: ViewMode; targets: MemberKpiTargets }) {
  if (mode === 'targets') {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 10 }}>
        <TargetTile label="Scheduled Calls" value={targets.calls_taken} actual={m.calls_taken} />
        <TargetTile label="Showed Calls" value={targets.showed} actual={m.showed} />
        <TargetTile label="Offers Made" value={targets.offers} actual={m.offers} />
        <TargetTile label="Deals Won" value={targets.deals} actual={m.sales} />
        <TargetTile label="Show Rate" value={targets.show_rate} actual={m.show_rate} isRate />
        <TargetTile label="Offer Rate" value={targets.offer_rate} actual={m.offer_rate} isRate />
        <TargetTile label="Close Rate" value={targets.close_rate} actual={m.close_rate} isRate />
        <TargetTile label="Revenue" value={targets.revenue} actual={m.revenue} unit="$" />
      </div>
    )
  }
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 10 }}>
      <KpiTile label="Scheduled Calls" value={m.calls_taken} metricKey="calls_taken" />
      <KpiTile label="Showed Calls" value={m.showed} metricKey="showed" />
      <KpiTile label="Offers Made" value={m.offers} metricKey="offers" />
      <KpiTile label="Deals Won" value={m.sales} metricKey="sales" />
      <KpiTile label="Show Rate" value={m.show_rate} isRate />
      <KpiTile label="Offer Rate" value={m.offer_rate} isRate />
      <KpiTile label="Close Rate" value={m.close_rate} isRate />
      <KpiTile label="Revenue" value={m.revenue} metricKey="revenue" unit="$" />
    </div>
  )
}

function SetterCloserKpis({ m, mode, targets }: { m: Metrics; mode: ViewMode; targets: MemberKpiTargets }) {
  if (mode === 'targets') {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 10 }}>
        <TargetTile label="Followers" value={targets.followers} actual={m.followers} />
        <TargetTile label="Responses" value={targets.replies} actual={m.replies} />
        <TargetTile label="Response Rate" value={targets.response_rate} actual={m.response_rate} isRate />
        <TargetTile label="Calls Booked" value={targets.calls_booked} actual={m.calls_booked} />
        <TargetTile label="Showed" value={targets.showed} actual={m.showed} />
        <TargetTile label="Offers Made" value={targets.offers} actual={m.offers} />
        <TargetTile label="Deals Won" value={targets.deals} actual={m.sales} />
        <TargetTile label="Show Rate" value={targets.show_rate} actual={m.show_rate} isRate />
        <TargetTile label="Close Rate" value={targets.close_rate} actual={m.close_rate} isRate />
        <TargetTile label="Revenue" value={targets.revenue} actual={m.revenue} unit="$" />
      </div>
    )
  }
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 10 }}>
      <KpiTile label="Followers" value={m.followers} metricKey="followers" />
      <KpiTile label="Responses" value={m.replies} metricKey="replies" />
      <KpiTile label="Response Rate" value={m.response_rate} isRate />
      <KpiTile label="Calls Booked" value={m.calls_booked} metricKey="calls_booked" />
      <KpiTile label="Showed" value={m.showed} metricKey="showed" />
      <KpiTile label="Offers Made" value={m.offers} metricKey="offers" />
      <KpiTile label="Deals Won" value={m.sales} metricKey="sales" />
      <KpiTile label="Show Rate" value={m.show_rate} isRate />
      <KpiTile label="Close Rate" value={m.close_rate} isRate />
      <KpiTile label="Revenue" value={m.revenue} metricKey="revenue" unit="$" />
    </div>
  )
}

// ── Main component ──────────────────────────────────────────────────────────

export default function TeamOverviewClient({
  member,
  totalNonNegs,
  completedNonNegs,
  openTeamTasks,
  openPersonalTasks,
  today,
  streak,
  eodQuestions,
  eodAnswers,
  eodHistory,
  eodSubmitted: initialEodSubmitted,
}: Props) {
  const router = useRouter()
  const nnPct = totalNonNegs > 0 ? Math.round((completedNonNegs / totalNonNegs) * 100) : 0

  // Dashboard controls
  const [period, setPeriod] = useState<Period>('week')
  const [viewMode, setViewMode] = useState<ViewMode>('live')

  // EOD submission state
  const [eodSubmitted, setEodSubmitted] = useState(initialEodSubmitted)
  const [localHistory, setLocalHistory] = useState<EodReport[]>(eodHistory)
  const [formAnswers, setFormAnswers] = useState<AnswerMap>(() => {
    // Pre-fill with today's answers if submitted (shouldn't happen but safe)
    if (eodAnswers.length > 0) {
      const m: AnswerMap = {}
      for (const a of eodAnswers) m[a.question_id] = a.value
      return m
    }
    const m: AnswerMap = {}
    for (const q of eodQuestions) {
      m[q.id] = q.type === 'number' ? '' : q.type === 'boolean' ? false : ''
    }
    return m
  })
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // Compute KPIs from filtered history
  const metrics = useMemo(() => {
    const filtered = filterByPeriod(localHistory, period, today)
    const raw = aggregateReports(filtered, eodQuestions)
    return deriveMetrics(raw)
  }, [localHistory, period, today, eodQuestions])

  const targets: MemberKpiTargets = (member.kpi_targets ?? {}) as MemberKpiTargets

  function setAnswer(qid: string, value: string | number | boolean) {
    setFormAnswers(prev => ({ ...prev, [qid]: value }))
  }

  async function handleEodSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (submitting) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      const answersArr = eodQuestions.map(q => ({
        question_id: q.id,
        value: formAnswers[q.id] ?? '',
      }))
      const res = await fetch('/api/team/eod', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ team_member_id: member.id, date: today, answers: answersArr }),
      })
      if (!res.ok) {
        const d = await res.json() as { error?: string }
        setSubmitError(d.error ?? 'Something went wrong')
        return
      }
      // Inject today's report into local history so KPIs update immediately
      const newReport: EodReport = {
        date: today,
        submitted_at: new Date().toISOString(),
        answers: answersArr,
      }
      setLocalHistory(prev => [newReport, ...prev.filter(r => r.date !== today)])
      setEodSubmitted(true)
      router.refresh()
    } finally {
      setSubmitting(false)
    }
  }

  const numberQuestions = eodQuestions.filter(q => q.type === 'number')
  const textQuestions = eodQuestions.filter(q => q.type !== 'number')
  const showEodForm = period === 'today' && !eodSubmitted && eodQuestions.length > 0

  const PERIOD_LABELS: Record<Period, string> = { today: 'Today', week: 'This Week', month: 'This Month' }

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      {/* ── Header ── */}
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-1)', margin: '0 0 4px' }}>
          Hey {member.name} 👋
        </h1>
        <p style={{ fontSize: 14, color: 'var(--text-2)', margin: 0 }}>
          {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
      </div>

      {/* ── Streak chip ── */}
      <div style={{ marginBottom: 20 }}>
        {streak > 0 ? (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)',
            color: '#F59E0B', borderRadius: 99, padding: '4px 12px',
            fontSize: 13, fontWeight: 600,
          }}>
            🔥 {streak} day streak
          </span>
        ) : (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: 'var(--surface-1)', border: '1px solid var(--border)',
            color: 'var(--text-3)', borderRadius: 99, padding: '4px 12px',
            fontSize: 13, fontWeight: 500,
          }}>
            No streak yet
          </span>
        )}
      </div>

      {/* ── KPI Dashboard ── */}
      <div style={{ ...CARD, padding: 20, marginBottom: 20 }}>
        {/* Controls row */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 10, marginBottom: 18, flexWrap: 'wrap',
        }}>
          {/* Period tabs */}
          <div style={{ display: 'flex', background: 'var(--surface-2)', borderRadius: 8, padding: 2, gap: 2 }}>
            {(['today', 'week', 'month'] as Period[]).map(p => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                style={{
                  padding: '5px 12px',
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: 600,
                  border: 'none',
                  cursor: 'pointer',
                  background: period === p ? 'var(--surface-1)' : 'transparent',
                  color: period === p ? 'var(--text-1)' : 'var(--text-3)',
                  boxShadow: period === p ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                  transition: 'all 120ms',
                }}
              >
                {PERIOD_LABELS[p]}
              </button>
            ))}
          </div>

          {/* Live / Targets toggle */}
          <div style={{ display: 'flex', background: 'var(--surface-2)', borderRadius: 8, padding: 2, gap: 2 }}>
            {(['live', 'targets'] as ViewMode[]).map(v => (
              <button
                key={v}
                onClick={() => setViewMode(v)}
                style={{
                  padding: '5px 12px',
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: 600,
                  border: 'none',
                  cursor: 'pointer',
                  background: viewMode === v ? (v === 'live' ? '#2563EB' : '#7C3AED') : 'transparent',
                  color: viewMode === v ? '#fff' : 'var(--text-3)',
                  transition: 'all 120ms',
                }}
              >
                {v === 'live' ? '📊 Live Numbers' : '🎯 Targets'}
              </button>
            ))}
          </div>
        </div>

        {/* ── EOD input form (today + not submitted) ── */}
        {showEodForm ? (
          <form onSubmit={handleEodSubmit}>
            <p style={{ fontSize: 12, color: 'var(--text-2)', margin: '0 0 14px' }}>
              Log today&apos;s numbers — your KPIs will update once submitted.
            </p>

            {numberQuestions.length > 0 && (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))',
                gap: 10,
                marginBottom: textQuestions.length > 0 ? 12 : 16,
              }}>
                {numberQuestions.map(q => (
                  <div key={q.id}>
                    <label style={{
                      fontSize: 10, fontWeight: 600, color: 'var(--text-2)',
                      display: 'block', marginBottom: 5,
                      textTransform: 'uppercase', letterSpacing: '0.04em', lineHeight: 1.4,
                    }}>
                      {q.label}
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={String(formAnswers[q.id] ?? '')}
                      onChange={e => setAnswer(q.id, e.target.value === '' ? '' : Number(e.target.value))}
                      placeholder="0"
                      className="input-base"
                      style={{ fontSize: 20, fontWeight: 700, textAlign: 'center', padding: '10px 8px' }}
                    />
                  </div>
                ))}
              </div>
            )}

            {textQuestions.map(q => (
              <div key={q.id} style={{ marginBottom: 12 }}>
                <label style={{
                  fontSize: 10, fontWeight: 600, color: 'var(--text-2)',
                  display: 'block', marginBottom: 5,
                  textTransform: 'uppercase', letterSpacing: '0.04em',
                }}>
                  {q.label}
                </label>
                {q.type === 'textarea' ? (
                  <textarea
                    value={String(formAnswers[q.id] ?? '')}
                    onChange={e => setAnswer(q.id, e.target.value)}
                    placeholder={q.placeholder ?? 'Share a highlight or blocker…'}
                    rows={2}
                    className="input-base"
                    style={{ resize: 'none' }}
                  />
                ) : (
                  <input
                    type="text"
                    value={String(formAnswers[q.id] ?? '')}
                    onChange={e => setAnswer(q.id, e.target.value)}
                    placeholder={q.placeholder ?? ''}
                    className="input-base"
                  />
                )}
              </div>
            ))}

            {submitError && (
              <div style={{
                background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.2)',
                borderRadius: 8, padding: '8px 12px', marginBottom: 10, fontSize: 12, color: '#EF4444',
              }}>
                {submitError}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              style={{
                width: '100%', padding: '12px 20px',
                background: submitting ? 'var(--border-strong)' : '#2563EB',
                color: '#fff', border: 'none', borderRadius: 10,
                fontSize: 14, fontWeight: 700,
                cursor: submitting ? 'not-allowed' : 'pointer',
                transition: 'background 120ms',
              }}
            >
              {submitting ? 'Submitting…' : 'Submit today\'s EOD →'}
            </button>
          </form>
        ) : (
          /* ── KPI tiles ── */
          <>
            {viewMode === 'targets' && Object.keys(targets).length === 0 && (
              <div style={{
                textAlign: 'center', padding: '20px 0',
                color: 'var(--text-2)', fontSize: 13,
              }}>
                <p style={{ margin: '0 0 4px', fontWeight: 600, color: 'var(--text-1)' }}>No targets configured yet</p>
                <p style={{ margin: 0 }}>Ask your coach to set KPI targets for you.</p>
              </div>
            )}

            {(viewMode === 'live' || Object.keys(targets).length > 0) && (
              <>
                {member.role === 'setter' && (
                  <SetterKpis m={metrics} mode={viewMode} targets={targets} />
                )}
                {member.role === 'closer' && (
                  <CloserKpis m={metrics} mode={viewMode} targets={targets} />
                )}
                {member.role === 'setter_closer' && (
                  <SetterCloserKpis m={metrics} mode={viewMode} targets={targets} />
                )}
              </>
            )}

            {/* Status indicators below the KPI grid */}
            {period === 'today' && eodSubmitted && (
              <p style={{ fontSize: 12, color: '#10B981', margin: '12px 0 0', fontWeight: 600 }}>
                ✓ EOD submitted for today
              </p>
            )}
            {period !== 'today' && !eodSubmitted && viewMode === 'live' && eodQuestions.length > 0 && (
              <p style={{ fontSize: 12, color: '#F59E0B', margin: '12px 0 0', fontWeight: 500 }}>
                ⚠ Today&apos;s numbers not logged yet — tap <strong>Today</strong> to submit your EOD.
              </p>
            )}
          </>
        )}
      </div>

      {/* ── Secondary stats ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
        <SecondaryCard
          label="Non-negotiables"
          value={`${completedNonNegs}/${totalNonNegs}`}
          sub={`${nnPct}%`}
          href="/team-dashboard/non-negotiables"
          accent={nnPct === 100 ? '#10B981' : undefined}
        />
        <SecondaryCard
          label="Team tasks"
          value={String(openTeamTasks.length)}
          sub="open"
          href="/team-dashboard/team-tasks"
        />
        <SecondaryCard
          label="My tasks"
          value={String(openPersonalTasks.length)}
          sub="open"
          href="/team-dashboard/my-tasks"
        />
      </div>

      {/* ── Quick links ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <QuickLink href="/team-dashboard/non-negotiables" label="Non-negotiables" emoji="✅" />
        <QuickLink href="/team-dashboard/my-tasks" label="My tasks" emoji="📋" />
        <QuickLink href="/team-dashboard/team-tasks" label="Team tasks" emoji="👥" />
        <QuickLink href="/team-dashboard/performance" label="Performance" emoji="📈" />
      </div>
    </div>
  )
}

// ── Small helpers ───────────────────────────────────────────────────────────

function SecondaryCard({ label, value, sub, href, accent }: {
  label: string; value: string; sub: string; href: string; accent?: string
}) {
  return (
    <Link href={href} style={{ textDecoration: 'none' }}>
      <div style={{ ...CARD, padding: 16, cursor: 'pointer' }}>
        <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-2)', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          {label}
        </p>
        <p style={{ fontSize: 22, fontWeight: 800, color: accent ?? 'var(--text-1)', margin: '0 0 1px', lineHeight: 1 }}>
          {value}
        </p>
        <p style={{ fontSize: 11, color: 'var(--text-3)', margin: 0 }}>{sub}</p>
      </div>
    </Link>
  )
}

function QuickLink({ href, label, emoji }: { href: string; label: string; emoji: string }) {
  return (
    <Link href={href} style={{ textDecoration: 'none' }}>
      <div style={{
        ...CARD, padding: '14px 16px',
        display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer',
      }}>
        <span style={{ fontSize: 20 }}>{emoji}</span>
        <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-1)' }}>{label}</span>
      </div>
    </Link>
  )
}
