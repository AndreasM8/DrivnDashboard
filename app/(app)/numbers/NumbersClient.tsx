'use client'

import { useState, useRef } from 'react'
import type { KpiTargets, MonthlySnapshot, Client, PaymentInstallment, Expense } from '@/types'
import RevenueChart from '@/components/numbers/RevenueChart'
import ExpensesSection from './ExpensesSection'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  baseCurrency: string
  targets: KpiTargets | null
  currentSnapshot: MonthlySnapshot | null
  lastMonthSnapshot: MonthlySnapshot | null
  history: MonthlySnapshot[]
  clients: Client[]
  installments: PaymentInstallment[]
  currentMonth: string
  expenses: Expense[]
  adSpendTotal: number
  monthlyRevenueDue: number
  totalContracted: number
  totalCashCollected: number
  totalOutstanding: number
  cashPending: number
  leadsReplied: number
  totalLeads: number
  totalClientsAcquired: number
}

type CompareMode = 'targets' | 'last_month'
type ScoreColor  = 'green' | 'amber' | 'red' | 'neutral'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat('en', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount)
}

function fmtMonth(month: string) {
  const [y, m] = month.split('-')
  return new Date(Number(y), Number(m) - 1).toLocaleDateString('en', { month: 'long', year: 'numeric' })
}

function score(value: number, target: number | null | undefined): ScoreColor {
  if (!target) return 'neutral'
  const ratio = value / target
  if (ratio >= 0.9) return 'green'
  if (ratio >= 0.6) return 'amber'
  return 'red'
}

const SCORE_ACCENT: Record<ScoreColor, string> = {
  green:   '#16A34A',
  amber:   '#D97706',
  red:     '#DC2626',
  neutral: 'var(--border-strong)',
}
const SCORE_TEXT: Record<ScoreColor, string> = {
  green:   '#16A34A',
  amber:   '#D97706',
  red:     '#DC2626',
  neutral: 'var(--text-3)',
}

function comparisonText(
  value: number,
  compareMode: CompareMode,
  target: number | null | undefined,
  lastValue: number | null | undefined,
  isCurrency: boolean,
  currency: string,
  isPercent: boolean,
  color: ScoreColor,
): string | null {
  if (compareMode === 'targets') {
    if (!target) return null
    const ratio = value / target
    const pctAbove = Math.round((ratio - 1) * 100)
    const pctToGo  = Math.round((1 - ratio) * 100)
    if (ratio >= 1)        return `↑ ${Math.abs(pctAbove)}% above target`
    if (color === 'green') return `On track — ${pctToGo}% to go`
    if (color === 'amber') return `${pctToGo}% below target — close`
    return `Well below target — focus here`
  } else {
    if (lastValue == null) return null
    const diff = value - lastValue
    if (isCurrency) {
      const sign = diff >= 0 ? '↑' : '↓'
      return `${sign} ${fmtCurrency(Math.abs(diff), currency)} vs last month`
    }
    if (isPercent) {
      const sign = diff >= 0 ? '↑' : '↓'
      return `${sign} ${Math.abs(diff).toFixed(1)}% vs last month`
    }
    const sign = diff >= 0 ? '↑' : '↓'
    return `${sign} ${Math.abs(diff).toFixed(diff % 1 === 0 ? 0 : 1)} vs last month`
  }
}

// ─── Section label ─────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: string }) {
  return (
    <p style={{
      fontSize: '11px',
      fontWeight: 500,
      textTransform: 'uppercase',
      letterSpacing: '0.06em',
      color: 'var(--text-3)',
      marginBottom: '10px',
    }}>
      {children}
    </p>
  )
}

// ─── KPI card ─────────────────────────────────────────────────────────────────

interface KpiCardProps {
  label: string
  value: number
  displayValue: string
  target?: number | null
  targetDisplay?: string
  compareMode: CompareMode
  lastValue?: number | null
  lastDisplay?: string
  color?: ScoreColor
  overrideAccent?: string
  subline?: string
  subline2?: string
  isCurrency?: boolean
  currency?: string
  isPercent?: boolean
  numSize?: number
  padding?: string
}

function KpiCard({
  label, value, displayValue, target, targetDisplay,
  compareMode, lastValue, lastDisplay,
  color = 'neutral', overrideAccent, subline, subline2,
  isCurrency = false, currency = 'NOK', isPercent = false,
  numSize = 28, padding = '16px',
}: KpiCardProps) {
  const accent    = overrideAccent ?? SCORE_ACCENT[color]
  const textColor = overrideAccent ? overrideAccent : SCORE_TEXT[color]
  const pct       = target ? Math.min((value / target) * 100, 100) : 0

  const showProgressBar = compareMode === 'targets' && !!target
  const diffText = comparisonText(value, compareMode, target, lastValue, isCurrency, currency, isPercent, color)

  return (
    <div style={{
      background:    'var(--surface-1)',
      border:        '1px solid var(--border)',
      borderLeft:    `3px solid ${accent}`,
      borderRadius:  'var(--radius-card)',
      padding,
      boxShadow:     'var(--shadow-card)',
      display:       'flex',
      flexDirection: 'column',
    }}>
      <p style={{ fontSize: '11px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-3)', marginBottom: '6px' }}>
        {label}
      </p>
      <p style={{ fontSize: `${numSize}px`, fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--text-1)', lineHeight: 1.1, marginBottom: (subline || subline2 || diffText) ? '4px' : 0 }}>
        {displayValue}
      </p>
      {subline && (
        <p style={{ fontSize: '11px', color: 'var(--text-2)', marginBottom: (subline2 || diffText) ? '3px' : 0 }}>
          {subline}
        </p>
      )}
      {subline2 && (
        <p style={{ fontSize: '11px', color: 'var(--text-2)', marginBottom: diffText ? '3px' : 0 }}>
          {subline2}
        </p>
      )}
      {diffText && (
        <p style={{ fontSize: '11px', fontWeight: 500, color: textColor, marginBottom: showProgressBar ? '6px' : targetDisplay ? '5px' : 0 }}>
          {diffText}
        </p>
      )}
      {showProgressBar && (
        <div style={{ width: '100%', height: '3px', background: 'var(--surface-3)', borderRadius: '99px', overflow: 'hidden', marginBottom: targetDisplay ? '5px' : 0 }}>
          <div style={{ height: '100%', borderRadius: '99px', background: accent, width: `${pct}%`, transition: 'width 400ms ease' }} />
        </div>
      )}
      {targetDisplay && compareMode === 'targets' && (
        <p style={{ fontSize: '11px', color: 'var(--text-3)' }}>Target: {targetDisplay}</p>
      )}
      {lastDisplay && compareMode === 'last_month' && (
        <p style={{ fontSize: '11px', color: 'var(--text-3)' }}>Last month: {lastDisplay}</p>
      )}
    </div>
  )
}

// ─── Sales Funnel ─────────────────────────────────────────────────────────────

interface FunnelStep {
  label: string
  value: number
}

function convRate(num: number, denom: number): number | null {
  if (denom <= 0) return null
  return (num / denom) * 100
}

function rateColor(rate: number | null): string {
  if (rate === null) return 'var(--text-3)'
  if (rate >= 50)    return '#16A34A'
  if (rate >= 20)    return '#D97706'
  return '#DC2626'
}

function SalesFunnel({ steps, leadsReplied }: { steps: FunnelStep[]; leadsReplied: number }) {
  const [followers, replied, booked, showed, signed] = steps.map(s => s.value)
  const allZero = steps.every(s => s.value === 0) && leadsReplied === 0

  const rates: (number | null)[] = [
    convRate(leadsReplied, followers),
    convRate(booked, leadsReplied),
    convRate(showed, booked),
    convRate(signed, showed),
  ]

  const boxes: { label: string; value: number; sub: string }[] = [
    { label: 'FOLLOWERS',   value: followers,    sub: `+${followers} this month`   },
    { label: 'REPLIED',     value: leadsReplied, sub: `+${leadsReplied} this month` },
    { label: 'CALL BOOKED', value: booked,       sub: `+${booked} this month`      },
    { label: 'SHOWED UP',   value: showed,       sub: `+${showed} this month`      },
    { label: 'SIGNED',      value: signed,       sub: `+${signed} this month`      },
  ]

  if (allZero) {
    return (
      <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-3)', fontSize: '13px' }}>
        No pipeline activity this month yet. Add leads to see your funnel.
      </div>
    )
  }

  return (
    <div style={{ overflowX: 'auto', paddingBottom: '4px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0', minWidth: '560px' }}>
        {boxes.map((box, i) => (
          <div key={box.label} style={{ display: 'flex', alignItems: 'center', flex: 1, minWidth: 0 }}>
            {/* Funnel box */}
            <div style={{
              flex: 1,
              background: 'var(--surface-1)',
              border: '1px solid var(--border)',
              borderRadius: '10px',
              padding: '14px 16px',
              minWidth: 0,
            }}>
              <p style={{ fontSize: '22px', fontWeight: 600, color: 'var(--text-1)', lineHeight: 1.1, marginBottom: '4px' }}>
                {box.value}
              </p>
              <p style={{ fontSize: '10px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-3)', marginBottom: '2px' }}>
                {box.label}
              </p>
              <p style={{ fontSize: '11px', color: 'var(--text-2)' }}>
                {box.sub}
              </p>
            </div>

            {/* Arrow + rate (between boxes) */}
            {i < boxes.length - 1 && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0 6px', flexShrink: 0 }}>
                <p style={{
                  fontSize: '9px',
                  fontWeight: 500,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: 'var(--text-3)',
                  marginBottom: '2px',
                  whiteSpace: 'nowrap',
                }}>
                  {(['Reply rate', 'Booking rate', 'Show-up rate', 'Closing rate'] as const)[i]}
                </p>
                <p style={{
                  fontSize: '13px',
                  fontWeight: 600,
                  color: rateColor(rates[i]),
                  marginBottom: '2px',
                  whiteSpace: 'nowrap',
                }}>
                  {rates[i] !== null ? `${rates[i]!.toFixed(0)}%` : '—'}
                </p>
                <svg viewBox="0 0 20 20" fill="none" width="16" height="16">
                  <path d="M4 10h12M11 6l5 4-5 4" stroke="var(--text-3)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── History table ────────────────────────────────────────────────────────────

function HistoryTable({
  history, currentMonth, baseCurrency, adSpendTotal,
  showUpTarget, closeTarget,
}: {
  history: MonthlySnapshot[]
  currentMonth: string
  baseCurrency: string
  adSpendTotal: number
  showUpTarget: number
  closeTarget: number
}) {
  function ratePill(value: number, good: number, warn: number) {
    const bg    = value >= good ? 'rgba(22,163,74,0.12)'  : value >= warn ? 'rgba(217,119,6,0.12)'  : 'rgba(220,38,38,0.1)'
    const color = value >= good ? '#16A34A'               : value >= warn ? '#D97706'               : '#DC2626'
    return (
      <span style={{ display: 'inline-block', background: bg, color, borderRadius: '4px', padding: '2px 6px', fontSize: '10px', fontWeight: 600 }}>
        {value.toFixed(1)}%
      </span>
    )
  }

  function roasPill(roas: number | null) {
    if (roas === null) return <span style={{ fontSize: '12px', color: 'var(--text-3)' }}>—</span>
    const bg    = roas >= 5 ? 'rgba(22,163,74,0.12)' : roas >= 2 ? 'rgba(217,119,6,0.12)' : 'rgba(220,38,38,0.1)'
    const color = roas >= 5 ? '#16A34A'              : roas >= 2 ? '#D97706'              : '#DC2626'
    return (
      <span style={{ display: 'inline-block', background: bg, color, borderRadius: '4px', padding: '2px 6px', fontSize: '10px', fontWeight: 600 }}>
        {roas.toFixed(1)}x
      </span>
    )
  }

  const sorted = [...history].sort((a, b) => b.month.localeCompare(a.month)).slice(0, 12)

  const columns = ['Month', 'Cash in', 'Contracts', 'Clients', 'Calls', 'Show-up %', 'Close %', 'Avg deal', 'Ad spend', 'Cash ROAS']

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', minWidth: '800px', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            {columns.map((h, i) => (
              <th
                key={h}
                style={{
                  paddingBottom: '10px',
                  textAlign: i > 0 ? 'right' : 'left',
                  fontSize: '11px',
                  fontWeight: 500,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  color: 'var(--text-3)',
                  borderBottom: '1px solid var(--border)',
                  whiteSpace: 'nowrap',
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map(s => {
            const isCurrent = s.month === currentMonth
            const avgDeal   = s.clients_signed > 0 ? fmtCurrency(s.revenue_contracted / s.clients_signed, baseCurrency) : '—'
            // For current month use live adSpendTotal prop; historical snapshots don't store ad spend — show "—"
            const adSpend   = isCurrent ? adSpendTotal : null
            const cashRoas  = adSpend && adSpend > 0 ? s.cash_collected / adSpend : null

            return (
              <tr
                key={s.month}
                style={{
                  background:   isCurrent ? 'rgba(37,99,235,0.04)' : 'transparent',
                  borderBottom: '1px solid var(--border)',
                  fontWeight:   isCurrent ? '600' : '400',
                }}
              >
                <td style={{ padding: '10px 12px 10px 0', fontSize: '12px', color: 'var(--text-1)', whiteSpace: 'nowrap' }}>
                  {fmtMonth(s.month)}
                  {isCurrent && (
                    <span style={{ display: 'inline-block', background: 'rgba(22,163,74,0.15)', color: '#16A34A', borderRadius: '4px', padding: '1px 5px', fontSize: '9px', fontWeight: 700, marginLeft: '6px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      LIVE
                    </span>
                  )}
                </td>
                <td style={{ padding: '10px 12px', fontSize: '12px', color: 'var(--text-1)', textAlign: 'right', whiteSpace: 'nowrap' }}>{fmtCurrency(s.cash_collected, baseCurrency)}</td>
                <td style={{ padding: '10px 12px', fontSize: '12px', color: 'var(--text-1)', textAlign: 'right', whiteSpace: 'nowrap' }}>{fmtCurrency(s.revenue_contracted, baseCurrency)}</td>
                <td style={{ padding: '10px 12px', fontSize: '12px', color: 'var(--text-1)', textAlign: 'right' }}>{s.clients_signed}</td>
                <td style={{ padding: '10px 12px', fontSize: '12px', color: 'var(--text-1)', textAlign: 'right' }}>{s.meetings_booked}</td>
                <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                  {ratePill(s.show_up_rate, showUpTarget, showUpTarget * 0.7)}
                </td>
                <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                  {ratePill(s.close_rate, closeTarget, closeTarget * 0.7)}
                </td>
                <td style={{ padding: '10px 12px', fontSize: '12px', color: 'var(--text-1)', textAlign: 'right', whiteSpace: 'nowrap' }}>{avgDeal}</td>
                <td style={{ padding: '10px 12px', fontSize: '12px', color: 'var(--text-1)', textAlign: 'right', whiteSpace: 'nowrap' }}>
                  {adSpend != null ? fmtCurrency(adSpend, baseCurrency) : '—'}
                </td>
                <td style={{ padding: '10px 12px', textAlign: 'right' }}>{roasPill(cashRoas)}</td>
              </tr>
            )
          })}
          {sorted.length === 0 && (
            <tr>
              <td colSpan={10} style={{ padding: '32px 0', textAlign: 'center', fontSize: '13px', color: 'var(--text-3)' }}>
                No history yet. Data will appear at the end of each month.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

// ─── All-time totals section ──────────────────────────────────────────────────

function AllTimeTotals({
  totalContracted, totalCashCollected, totalOutstanding, activePlanCount,
  totalClientsAcquired, totalLeads, totalCalls, baseCurrency,
}: {
  totalContracted: number
  totalCashCollected: number
  totalOutstanding: number
  activePlanCount: number
  totalClientsAcquired: number
  totalLeads: number
  totalCalls: number
  baseCurrency: string
}) {
  const collectedPct = totalContracted > 0 ? Math.round((totalCashCollected / totalContracted) * 100) : 0

  const items: { label: string; display: string; accent: string; sub: string }[] = [
    {
      label:   'Total contracted',
      display: fmtCurrency(totalContracted, baseCurrency),
      accent:  '#7C3AED',
      sub:     'Including future payments',
    },
    {
      label:   'Cash collected',
      display: fmtCurrency(totalCashCollected, baseCurrency),
      accent:  '#16A34A',
      sub:     `${collectedPct}% of contracted`,
    },
    {
      label:   'Outstanding',
      display: fmtCurrency(totalOutstanding, baseCurrency),
      accent:  '#D97706',
      sub:     `From ${activePlanCount} active plan${activePlanCount !== 1 ? 's' : ''}`,
    },
    {
      label:   'Clients acquired',
      display: String(totalClientsAcquired),
      accent:  '#2563EB',
      sub:     'Total ever signed',
    },
    {
      label:   'Total followers',
      display: String(totalLeads),
      accent:  'var(--border-strong)',
      sub:     'All leads in pipeline',
    },
    {
      label:   'Calls booked',
      display: String(totalCalls),
      accent:  'var(--border-strong)',
      sub:     'Booked across all months',
    },
  ]

  return (
    <div className="grid grid-cols-2" style={{ gap: '10px' }}>
      {items.map(s => (
        <div
          key={s.label}
          style={{
            background:   'var(--surface-1)',
            border:       '1px solid var(--border)',
            borderLeft:   `3px solid ${s.accent}`,
            borderRadius: 'var(--radius-card)',
            padding:      '14px 16px',
            boxShadow:    'var(--shadow-card)',
          }}
        >
          <p style={{ fontSize: '11px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-3)', marginBottom: '6px' }}>{s.label}</p>
          <p style={{ fontSize: '22px', fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--text-1)', lineHeight: 1, marginBottom: '4px', fontVariantNumeric: 'tabular-nums' }}>
            {s.display}
          </p>
          <p style={{ fontSize: '11px', color: 'var(--text-2)' }}>{s.sub}</p>
        </div>
      ))}
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function NumbersClient({
  baseCurrency, targets, currentSnapshot, lastMonthSnapshot, history,
  clients, installments, currentMonth, expenses, adSpendTotal,
  monthlyRevenueDue, totalContracted, totalCashCollected,
  totalOutstanding, cashPending, leadsReplied, totalLeads, totalClientsAcquired,
}: Props) {
  const [viewMode, setViewMode]       = useState<'month' | 'alltime'>('month')
  const [compareMode, setCompareMode] = useState<CompareMode>('targets')
  const [lastMonthLocked, setLastMonthLocked] = useState<boolean>(() => {
    if (lastMonthSnapshot !== null) return false
    if (typeof window !== 'undefined' && localStorage.getItem('drivn_lastmonth_unlocked') === '1') return false
    return true
  })
  const [showUnlockModal, setShowUnlockModal] = useState(false)

  const availableMonths = [
    currentMonth,
    ...history.map(s => s.month).filter(m => m !== currentMonth),
  ].sort((a, b) => b.localeCompare(a))

  const [selectedMonth, setSelectedMonth] = useState(currentMonth)

  const selectedIdx  = availableMonths.indexOf(selectedMonth)
  const canGoBack    = selectedIdx < availableMonths.length - 1
  const canGoForward = selectedIdx > 0

  const snap: MonthlySnapshot | null = selectedMonth === currentMonth
    ? currentSnapshot
    : history.find(s => s.month === selectedMonth) ?? null

  const prevMonth = availableMonths[selectedIdx + 1]
  const last: MonthlySnapshot | null = selectedMonth === currentMonth
    ? lastMonthSnapshot
    : (prevMonth ? history.find(s => s.month === prevMonth) ?? null : null)

  function getTarget<K extends keyof KpiTargets>(key: K): number | null {
    if (compareMode === 'last_month') return null
    return targets ? (targets[key] as number) : null
  }

  // Swipe support
  const touchStartX = useRef<number | null>(null)
  function handleTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX
  }
  function handleTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null) return
    const dx = e.changedTouches[0].clientX - touchStartX.current
    touchStartX.current = null
    if (Math.abs(dx) < 40) return
    if (dx < 0 && canGoBack)    setSelectedMonth(availableMonths[selectedIdx + 1])
    if (dx > 0 && canGoForward) setSelectedMonth(availableMonths[selectedIdx - 1])
  }

  const NAV_BTN: React.CSSProperties = {
    width: '32px', height: '32px',
    borderRadius: 'var(--radius-btn)',
    background: 'var(--surface-2)',
    border: '1px solid var(--border)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--text-2)',
    transition: 'background 120ms ease, color 120ms ease',
  }

  // ── Derived values ──────────────────────────────────────────────────────────
  const avgDeal       = snap?.clients_signed ? (snap.revenue_contracted / snap.clients_signed) : 0
  const lastAvgDeal   = last?.clients_signed ? (last.revenue_contracted / last.clients_signed) : null

  const activePlanCount = clients.filter(c => c.payment_type === 'plan' || c.payment_type === 'split').length

  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0)

  const cashRoas    = adSpendTotal > 0 ? (snap?.cash_collected ?? 0) / adSpendTotal : null
  const revenueRoas = adSpendTotal > 0 ? (snap?.revenue_contracted ?? 0) / adSpendTotal : null
  const profitRoas  = adSpendTotal > 0 ? ((snap?.cash_collected ?? 0) - (totalExpenses + adSpendTotal)) / adSpendTotal : null

  // Default targets (spec-specified fallbacks when no target set)
  const DEFAULT_SHOW_UP = 75
  const DEFAULT_CLOSE   = 25
  const DEFAULT_FOLLOWERS = 200

  const showUpTarget  = getTarget('show_up_target')   ?? (compareMode === 'targets' ? DEFAULT_SHOW_UP : null)
  const closeTarget   = getTarget('close_rate_target') ?? (compareMode === 'targets' ? DEFAULT_CLOSE   : null)
  const followersTarget = getTarget('followers_target') ?? (compareMode === 'targets' ? DEFAULT_FOLLOWERS : null)

  // avg client LTV
  const avgClientLtv = clients.length > 0 ? clients.reduce((s, c) => s + c.total_amount, 0) / clients.length : 0

  // History for chart: current live snapshot + all past snapshots
  const chartHistory: MonthlySnapshot[] = [
    ...(currentSnapshot ? [currentSnapshot] : []),
    ...history.filter(s => s.month !== currentMonth),
  ]

  // All-time call total across all recorded months (booked, matches history table CALLS column)
  const totalCalls = chartHistory.reduce((sum, s) => sum + (s.meetings_booked ?? 0), 0)

  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >

      {/* ── Sticky header bar ──────────────────────────────────────────────── */}
      <div style={{
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'space-between',
        padding:        '10px 24px',
        borderBottom:   '1px solid var(--border)',
        background:     'var(--surface-1)',
        gap:            '12px',
        flexWrap:       'wrap',
        flexShrink:     0,
        position:       'sticky',
        top:            0,
        zIndex:         10,
      }}>

        {/* Left: view toggle + (month nav when in month mode) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>

          {/* Month / All time pill */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '2px', background: 'var(--surface-2)', borderRadius: 'var(--radius-btn)', padding: '3px' }}>
            {(['month', 'alltime'] as const).map(mode => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                style={{
                  padding:      '4px 14px',
                  borderRadius: '5px',
                  fontSize:     '12px',
                  fontWeight:   viewMode === mode ? 600 : 400,
                  color:        viewMode === mode ? 'var(--text-1)' : 'var(--text-2)',
                  background:   viewMode === mode ? 'var(--surface-1)' : 'transparent',
                  border:       'none',
                  cursor:       'pointer',
                  boxShadow:    viewMode === mode ? 'var(--shadow-card)' : 'none',
                  transition:   'all 120ms ease',
                  whiteSpace:   'nowrap',
                }}
              >
                {mode === 'month' ? 'Month' : 'All time'}
              </button>
            ))}
          </div>

          {/* Month navigation — only in month view */}
          {viewMode === 'month' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <button
                onClick={() => canGoBack && setSelectedMonth(availableMonths[selectedIdx + 1])}
                disabled={!canGoBack}
                style={{ ...NAV_BTN, opacity: canGoBack ? 1 : 0.3, cursor: canGoBack ? 'pointer' : 'not-allowed' }}
                title="Previous month"
              >
                <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14">
                  <path fillRule="evenodd" d="M11.78 5.22a.75.75 0 0 1 0 1.06L8.06 10l3.72 3.72a.75.75 0 1 1-1.06 1.06l-4.25-4.25a.75.75 0 0 1 0-1.06l4.25-4.25a.75.75 0 0 1 1.06 0Z" clipRule="evenodd" />
                </svg>
              </button>

              <div style={{ position: 'relative' }}>
                <select
                  value={selectedMonth}
                  onChange={e => setSelectedMonth(e.target.value)}
                  style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%', height: '100%' }}
                  aria-label="Jump to month"
                >
                  {availableMonths.map(m => (
                    <option key={m} value={m}>{fmtMonth(m)}</option>
                  ))}
                </select>
                <div style={{
                  display:        'flex',
                  alignItems:     'center',
                  gap:            '6px',
                  padding:        '5px 10px',
                  background:     'var(--surface-2)',
                  border:         '1px solid var(--border)',
                  borderRadius:   'var(--radius-btn)',
                  cursor:         'pointer',
                  userSelect:     'none',
                  minWidth:       '148px',
                  justifyContent: 'center',
                }}>
                  <span style={{ fontSize: '13px', fontWeight: 600, letterSpacing: '-0.01em', color: 'var(--text-1)' }}>
                    {fmtMonth(selectedMonth)}
                  </span>
                  {selectedMonth === currentMonth && (
                    <span style={{ display: 'inline-block', background: 'rgba(22,163,74,0.15)', color: '#16A34A', borderRadius: '4px', padding: '1px 5px', fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      LIVE
                    </span>
                  )}
                  <svg viewBox="0 0 20 20" fill="currentColor" width="11" height="11" style={{ color: 'var(--text-3)', flexShrink: 0 }}>
                    <path fillRule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
                  </svg>
                </div>
              </div>

              <button
                onClick={() => canGoForward && setSelectedMonth(availableMonths[selectedIdx - 1])}
                disabled={!canGoForward}
                style={{ ...NAV_BTN, opacity: canGoForward ? 1 : 0.3, cursor: canGoForward ? 'pointer' : 'not-allowed' }}
                title="Next month"
              >
                <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14">
                  <path fillRule="evenodd" d="M8.22 5.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06-1.06L11.94 10 8.22 6.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          )}
        </div>

        {/* Compare mode switcher — only in month view */}
        {viewMode === 'month' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '2px', background: 'var(--surface-2)', borderRadius: 'var(--radius-btn)', padding: '3px' }}>
          <button
            onClick={() => setCompareMode('targets')}
            style={{
              padding:    '4px 12px',
              borderRadius: '5px',
              fontSize:   '11px',
              fontWeight: compareMode === 'targets' ? '500' : '400',
              color:      compareMode === 'targets' ? 'var(--text-1)' : 'var(--text-2)',
              background: compareMode === 'targets' ? 'var(--surface-1)' : 'transparent',
              border:     'none',
              cursor:     'pointer',
              boxShadow:  compareMode === 'targets' ? 'var(--shadow-card)' : 'none',
              transition: 'all 120ms ease',
            }}
          >
            vs my targets
          </button>

          {lastMonthLocked ? (
            <button
              onClick={() => setShowUnlockModal(true)}
              title="Available after your first full month"
              style={{
                padding:    '4px 12px',
                borderRadius: '5px',
                fontSize:   '11px',
                color:      'var(--text-3)',
                background: 'transparent',
                border:     'none',
                cursor:     'not-allowed',
                opacity:    0.5,
                display:    'flex',
                alignItems: 'center',
                gap:        '3px',
              }}
            >
              vs last month
              <svg viewBox="0 0 16 16" fill="currentColor" width="10" height="10">
                <path fillRule="evenodd" d="M8 1a3.5 3.5 0 0 0-3.5 3.5V6H4a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V7a1 1 0 0 0-1-1h-.5V4.5A3.5 3.5 0 0 0 8 1Zm2 5V4.5a2 2 0 1 0-4 0V6h4Z" clipRule="evenodd" />
              </svg>
            </button>
          ) : (
            <button
              onClick={() => setCompareMode('last_month')}
              style={{
                padding:    '4px 12px',
                borderRadius: '5px',
                fontSize:   '11px',
                fontWeight: compareMode === 'last_month' ? '500' : '400',
                color:      compareMode === 'last_month' ? 'var(--text-1)' : 'var(--text-2)',
                background: compareMode === 'last_month' ? 'var(--surface-1)' : 'transparent',
                border:     'none',
                cursor:     'pointer',
                boxShadow:  compareMode === 'last_month' ? 'var(--shadow-card)' : 'none',
                transition: 'all 120ms ease',
              }}
            >
              vs last month
            </button>
          )}
        </div>
        )}
      </div>

      {/* ── Unlock modal ──────────────────────────────────────────────────────── */}
      {showUnlockModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)', padding: '16px' }}>
          <div style={{ background: 'var(--surface-1)', borderRadius: 'var(--radius-panel)', boxShadow: 'var(--shadow-dropdown)', width: '100%', maxWidth: '360px', padding: '24px' }}>
            <h2 className="section-title" style={{ marginBottom: '8px' }}>Unlock month-on-month comparison</h2>
            <p style={{ fontSize: '13px', color: 'var(--text-2)', marginBottom: '20px' }}>
              Have you already tracked your numbers from last month manually? If so, confirm and we&apos;ll let you compare.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button
                onClick={() => {
                  localStorage.setItem('drivn_lastmonth_unlocked', '1')
                  setLastMonthLocked(false)
                  setShowUnlockModal(false)
                }}
                className="btn-primary"
                style={{ width: '100%', padding: '10px', justifyContent: 'center' }}
              >
                Confirm — I have last month&apos;s data
              </button>
              <button
                onClick={() => setShowUnlockModal(false)}
                className="btn-ghost"
                style={{ width: '100%', padding: '10px', justifyContent: 'center' }}
              >
                Not yet
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Body ─────────────────────────────────────────────────────────────── */}
      <div style={{ padding: '20px 24px 40px', display: 'flex', flexDirection: 'column', gap: '32px' }}>

        {/* ══ MONTH VIEW ═══════════════════════════════════════════════════════ */}
        {viewMode === 'month' && (<>

        {/* No last month notice */}
        {compareMode === 'last_month' && last === null && (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '12px 14px', background: 'rgba(37,99,235,0.05)', border: '1px solid rgba(37,99,235,0.15)', borderRadius: 'var(--radius-card)', fontSize: '13px', color: 'var(--accent)' }}>
            <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14" style={{ flexShrink: 0, marginTop: '2px' }}>
              <path fillRule="evenodd" d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-7-4a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM9 9a.75.75 0 0 0 0 1.5h.253a.25.25 0 0 1 .244.304l-.459 2.066A1.75 1.75 0 0 0 10.747 15H11a.75.75 0 0 0 0-1.5h-.253a.25.25 0 0 1-.244-.304l.459-2.066A1.75 1.75 0 0 0 9.253 9H9Z" clipRule="evenodd" />
            </svg>
            No last month data yet. Numbers will appear once you have a full month recorded.
          </div>
        )}

        {/* ── Section 1: MONEY THIS MONTH ──────────────────────────────────── */}
        <div>
          <SectionLabel>Money this month</SectionLabel>

          {/* Top row: 2 large cards */}
          <div className="grid grid-cols-2" style={{ gap: '10px', marginBottom: '10px' }}>

            {/* Card 1: Cash collected */}
            <KpiCard
              label="Cash collected"
              value={snap?.cash_collected ?? 0}
              displayValue={fmtCurrency(snap?.cash_collected ?? 0, baseCurrency)}
              target={getTarget('cash_target')}
              targetDisplay={targets?.cash_target ? fmtCurrency(targets.cash_target, baseCurrency) : undefined}
              compareMode={compareMode}
              lastValue={last?.cash_collected ?? null}
              lastDisplay={last?.cash_collected != null ? fmtCurrency(last.cash_collected, baseCurrency) : undefined}
              color={score(snap?.cash_collected ?? 0, compareMode === 'targets' ? getTarget('cash_target') : last?.cash_collected)}
              overrideAccent="#16A34A"
              isCurrency
              currency={baseCurrency}
              numSize={32}
              padding="20px 18px"
              subline="Collected this month"
              subline2={selectedMonth === currentMonth && cashPending > 0 ? `+ ${fmtCurrency(cashPending, baseCurrency)} still pending` : undefined}
            />

            {/* Card 2: New contracts */}
            <KpiCard
              label="New contracts"
              value={snap?.revenue_contracted ?? 0}
              displayValue={snap?.revenue_contracted ? fmtCurrency(snap.revenue_contracted, baseCurrency) : '—'}
              target={getTarget('revenue_target')}
              targetDisplay={targets?.revenue_target ? fmtCurrency(targets.revenue_target, baseCurrency) : undefined}
              compareMode={compareMode}
              lastValue={last?.revenue_contracted ?? null}
              lastDisplay={last?.revenue_contracted != null ? fmtCurrency(last.revenue_contracted, baseCurrency) : undefined}
              color={score(snap?.revenue_contracted ?? 0, compareMode === 'targets' ? getTarget('revenue_target') : last?.revenue_contracted)}
              overrideAccent="#7C3AED"
              isCurrency
              currency={baseCurrency}
              numSize={32}
              padding="20px 18px"
              subline={snap?.clients_signed ? `${snap.clients_signed} new client${snap.clients_signed !== 1 ? 's' : ''} signed` : 'No new clients this month'}
            />
          </div>

          {/* Bottom row: 2 medium cards */}
          <div className="grid grid-cols-2" style={{ gap: '10px' }}>

            {/* Card 3: Pending this month */}
            <KpiCard
              label="Pending"
              value={cashPending}
              displayValue={cashPending > 0 ? fmtCurrency(cashPending, baseCurrency) : '—'}
              compareMode={compareMode}
              overrideAccent="#2563EB"
              numSize={28}
              subline="Still to collect this month"
            />

            {/* Card 4: Avg deal size */}
            <KpiCard
              label="Avg deal size"
              value={avgDeal}
              displayValue={avgDeal > 0 ? fmtCurrency(avgDeal, baseCurrency) : '—'}
              compareMode={compareMode}
              lastValue={lastAvgDeal}
              lastDisplay={lastAvgDeal != null ? fmtCurrency(lastAvgDeal, baseCurrency) : undefined}
              color="neutral"
              isCurrency
              currency={baseCurrency}
              numSize={28}
              subline={
                last?.clients_signed && lastAvgDeal != null && avgDeal > 0
                  ? (avgDeal >= lastAvgDeal
                      ? `↑ ${fmtCurrency(avgDeal - lastAvgDeal, baseCurrency)} vs last month`
                      : `↓ ${fmtCurrency(lastAvgDeal - avgDeal, baseCurrency)} vs last month`)
                  : avgDeal === 0 ? 'No deals this month' : undefined
              }
            />
          </div>
        </div>

        {/* ── Section 2: SALES FUNNEL ───────────────────────────────────────── */}
        <div>
          <div style={{ background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: 'var(--radius-card)', padding: '16px 20px', boxShadow: 'var(--shadow-card)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <SectionLabel>Sales funnel</SectionLabel>
              <a href="/pipeline" style={{ fontSize: '12px', color: 'var(--accent)', textDecoration: 'none', fontWeight: 500 }}>
                View pipeline →
              </a>
            </div>
            <SalesFunnel
              leadsReplied={leadsReplied}
              steps={[
                { label: 'New followers',  value: snap?.new_followers ?? 0  },
                { label: 'Replied',        value: leadsReplied              },
                { label: 'Call booked',    value: snap?.meetings_booked ?? 0 },
                { label: 'Showed up',      value: snap?.calls_held ?? 0     },
                { label: 'Signed',         value: snap?.clients_signed ?? 0 },
              ]}
            />
          </div>
        </div>

        {/* ── Section 3: IN-DEPTH METRICS ──────────────────────────────────── */}
        <div>
          <SectionLabel>In-depth metrics</SectionLabel>
          <div className="grid grid-cols-2" style={{ gap: '10px' }}>
            {(() => {
              const callsBooked  = snap?.meetings_booked ?? 0
              const showed       = snap?.calls_held ?? 0
              const revDue       = selectedMonth === currentMonth ? monthlyRevenueDue : (snap?.revenue_contracted ?? 0)
              const revPerCall   = callsBooked > 0 ? revDue / callsBooked : null
              const revPerShow   = showed > 0 ? revDue / showed : null
              const ltvCash      = clients.length > 0 ? clients.reduce((s, c) => s + c.total_amount, 0) / clients.length : null
              const planClients  = clients.filter(c => c.payment_type === 'plan' || c.payment_type === 'split')
              const avgMonths    = planClients.length > 0
                ? planClients.reduce((s, c) => s + (c.plan_months ?? 0), 0) / planClients.length
                : null

              const metric = (label: string, display: string | null, sub: string) => (
                <div style={{
                  background: 'var(--surface-1)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-card)',
                  padding: '16px 18px',
                  boxShadow: 'var(--shadow-card)',
                }}>
                  <p style={{ fontSize: '11px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-3)', marginBottom: '6px' }}>{label}</p>
                  <p style={{ fontSize: '26px', fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--text-1)', lineHeight: 1, marginBottom: '4px', fontVariantNumeric: 'tabular-nums' }}>
                    {display ?? '—'}
                  </p>
                  <p style={{ fontSize: '11px', color: 'var(--text-3)' }}>{sub}</p>
                </div>
              )

              return (
                <>
                  {metric('Revenue per call', revPerCall !== null ? fmtCurrency(revPerCall, baseCurrency) : null, `Based on ${callsBooked} call${callsBooked !== 1 ? 's' : ''} booked`)}
                  {metric('Revenue per show', revPerShow !== null ? fmtCurrency(revPerShow, baseCurrency) : null, `Based on ${showed} call${showed !== 1 ? 's' : ''} showed up`)}
                  {metric('LTV (cash)', ltvCash !== null ? fmtCurrency(ltvCash, baseCurrency) : null, `Across ${clients.length} active client${clients.length !== 1 ? 's' : ''}`)}
                  {metric('LTV (months)', avgMonths !== null ? `${avgMonths.toFixed(1)} mo` : null, planClients.length > 0 ? `Avg of ${planClients.length} plan/split client${planClients.length !== 1 ? 's' : ''}` : 'No plan/split clients yet')}
                </>
              )
            })()}
          </div>
        </div>

        {/* ── Section 4: RETURN ON AD SPEND ────────────────────────────────── */}
        <div>
          <SectionLabel>Return on ad spend</SectionLabel>
          <div style={{ background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: 'var(--radius-card)', padding: '20px 18px', boxShadow: 'var(--shadow-card)' }}>
            {adSpendTotal === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', padding: '20px 0', color: 'var(--text-3)' }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="32" height="32">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
                </svg>
                <p style={{ fontSize: '13px', textAlign: 'center' }}>
                  Log your ad spend to see your return on investment
                </p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr' }}>
                {([
                  {
                    label:   'Cash ROAS',
                    value:   cashRoas,
                    sub:     'Per AED spent on ads',
                    formula: `${fmtCurrency(snap?.cash_collected ?? 0, baseCurrency)} ÷ ${fmtCurrency(adSpendTotal, baseCurrency)}`,
                  },
                  {
                    label:   'Revenue ROAS',
                    value:   revenueRoas,
                    sub:     'Contracted per AED spent',
                    formula: null,
                  },
                  {
                    label:   'Profit ROAS',
                    value:   profitRoas,
                    sub:     'Profit per AED spent',
                    formula: null,
                  },
                ] as { label: string; value: number | null; sub: string; formula: string | null }[]).map((col, i) => (
                  <div
                    key={col.label}
                    style={{
                      padding:     '0 16px',
                      borderRight: i < 2 ? '1px solid var(--border)' : 'none',
                      paddingLeft: i === 0 ? 0 : '16px',
                    }}
                  >
                    <p style={{ fontSize: '11px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-3)', marginBottom: '6px' }}>
                      {col.label}
                    </p>
                    <p style={{ fontSize: '32px', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text-1)', lineHeight: 1 }}>
                      {col.value != null ? `${col.value.toFixed(1)}x` : '—'}
                    </p>
                    <p style={{ fontSize: '11px', color: 'var(--text-2)', marginTop: '4px' }}>{col.sub}</p>
                    {col.formula && (
                      <p style={{ fontSize: '11px', fontFamily: 'monospace', color: 'var(--text-3)', marginTop: '4px' }}>
                        {col.formula}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Expenses & profit ─────────────────────────────────────────────── */}
        <ExpensesSection
          expenses={expenses}
          adSpendTotal={adSpendTotal}
          currency={baseCurrency}
          currentMonth={currentMonth}
          cashCollected={snap?.cash_collected ?? 0}
        />

        </>)}

        {/* ══ ALL TIME VIEW ════════════════════════════════════════════════════ */}
        {viewMode === 'alltime' && (<>

        {/* Stats grid */}
        <AllTimeTotals
          totalContracted={totalContracted}
          totalCashCollected={totalCashCollected}
          totalOutstanding={totalOutstanding}
          activePlanCount={activePlanCount}
          totalClientsAcquired={totalClientsAcquired}
          totalLeads={totalLeads}
          totalCalls={totalCalls}
          baseCurrency={baseCurrency}
        />

        {/* Performance chart */}
        <div>
          <SectionLabel>Performance over time</SectionLabel>
          <div style={{ background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: 'var(--radius-card)', padding: '20px', boxShadow: 'var(--shadow-card)' }}>
            <RevenueChart
              history={chartHistory}
              baseCurrency={baseCurrency}
              targets={targets}
            />
          </div>
        </div>

        {/* History table */}
        <div>
          <SectionLabel>Monthly history</SectionLabel>
          <div style={{ background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: 'var(--radius-card)', padding: '20px', boxShadow: 'var(--shadow-card)' }}>
            <HistoryTable
              history={chartHistory}
              currentMonth={currentMonth}
              baseCurrency={baseCurrency}
              adSpendTotal={adSpendTotal}
              showUpTarget={targets?.show_up_target ?? DEFAULT_SHOW_UP}
              closeTarget={targets?.close_rate_target ?? DEFAULT_CLOSE}
            />
          </div>
        </div>

        </>)}

      </div>
    </div>
  )
}
