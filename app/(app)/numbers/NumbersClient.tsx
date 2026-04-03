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

function score(value: number, target: number | null | undefined, higherIsBetter = true): ScoreColor {
  if (!target) return 'neutral'
  const ratio = value / target
  if (higherIsBetter) {
    if (ratio >= 0.9) return 'green'
    if (ratio >= 0.6) return 'amber'
    return 'red'
  } else {
    if (ratio <= 1.1) return 'green'
    if (ratio <= 1.5) return 'amber'
    return 'red'
  }
}

const SCORE_ACCENT: Record<ScoreColor, string> = {
  green:   'var(--success)',
  amber:   'var(--warning)',
  red:     'var(--danger)',
  neutral: 'var(--border-strong)',
}
const SCORE_TEXT: Record<ScoreColor, string> = {
  green:   'var(--success)',
  amber:   'var(--warning)',
  red:     'var(--danger)',
  neutral: 'var(--text-3)',
}

// ─── Comparison text helper ───────────────────────────────────────────────────

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
    if (ratio >= 1)   return `↑ ${Math.abs(pctAbove)}% above target`
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
  overrideAccent?: string  // for fixed-color cards (purple, blue)
  subline?: string
  isCurrency?: boolean
  currency?: string
  isPercent?: boolean
  hero?: boolean           // Section 1 hero style (larger number, more padding)
  numSize?: number         // override font size for number
}

function KpiCard({
  label, value, displayValue, target, targetDisplay,
  compareMode, lastValue, lastDisplay,
  color = 'neutral', overrideAccent, subline,
  isCurrency = false, currency = 'NOK', isPercent = false,
  hero = false, numSize,
}: KpiCardProps) {
  const accent    = overrideAccent ?? SCORE_ACCENT[color]
  const textColor = overrideAccent ? overrideAccent : SCORE_TEXT[color]
  const pct       = target ? Math.min((value / target) * 100, 100) : 0

  const showProgressBar = compareMode === 'targets' && !!target
  const diffText = comparisonText(value, compareMode, target, lastValue, isCurrency, currency, isPercent, color)

  const resolvedNumSize = numSize ?? (hero ? 30 : 28)
  const padding         = hero ? '20px 18px' : '14px 16px'

  return (
    <div
      style={{
        background:   'var(--surface-1)',
        border:       '1px solid var(--border)',
        borderLeft:   `3px solid ${accent}`,
        borderRadius: 'var(--radius-card)',
        padding,
        boxShadow:    'var(--shadow-card)',
        display:      'flex',
        flexDirection:'column',
      }}
    >
      <p style={{ fontSize: '11px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-3)', marginBottom: '6px' }}>
        {label}
      </p>
      <p style={{ fontSize: `${resolvedNumSize}px`, fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--text-1)', marginBottom: subline ? '4px' : diffText ? '8px' : 0, lineHeight: 1.1 }}>
        {displayValue}
      </p>
      {subline && (
        <p style={{ fontSize: '11px', color: 'var(--text-2)', marginBottom: diffText ? '6px' : 0 }}>
          {subline}
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

// ─── Payment tracker ──────────────────────────────────────────────────────────

function PaymentTracker({ clients, installments, baseCurrency }: { clients: Client[]; installments: PaymentInstallment[]; baseCurrency: string }) {
  const planClients = clients.filter(c => c.payment_type === 'plan')
  const hasOverdue  = installments.some(i => !i.paid && new Date(i.due_date) < new Date())

  if (planClients.length === 0) return null

  return (
    <div style={{ background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: 'var(--radius-panel)', padding: '20px', boxShadow: 'var(--shadow-card)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <h2 className="section-title">Payment plan tracker</h2>
        {hasOverdue && (
          <span className="badge" style={{ background: 'rgba(220,38,38,0.1)', color: 'var(--danger)', fontSize: '10px' }}>
            Overdue payments
          </span>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {planClients.map(client => {
          const clientInsts = installments
            .filter(i => i.client_id === client.id)
            .sort((a, b) => a.month_number - b.month_number)
          const collected = clientInsts.filter(i => i.paid).reduce((sum, i) => sum + i.amount, 0)

          return (
            <div key={client.id} style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ width: '120px', flexShrink: 0 }}>
                <p style={{ fontSize: '12px', fontWeight: '500', color: 'var(--text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {client.full_name || client.ig_username}
                </p>
                <p style={{ fontSize: '11px', color: 'var(--text-3)' }}>{fmtCurrency(collected, baseCurrency)} collected</p>
              </div>
              <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', flex: 1 }}>
                {clientInsts.map(inst => {
                  const bg = inst.paid
                    ? 'var(--success)'
                    : new Date(inst.due_date) < new Date()
                      ? 'var(--danger)'
                      : 'var(--surface-3)'
                  return (
                    <span key={inst.id} title={`Month ${inst.month_number}`} style={{ width: '14px', height: '14px', borderRadius: '50%', background: bg, flexShrink: 0, display: 'inline-block' }} />
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '14px', paddingTop: '14px', borderTop: '1px solid var(--border)' }}>
        {[
          { bg: 'var(--success)', label: 'Paid' },
          { bg: 'var(--danger)',  label: 'Missed' },
          { bg: 'var(--surface-3)', label: 'Upcoming' },
        ].map(d => (
          <div key={d.label} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: d.bg, flexShrink: 0 }} />
            <span style={{ fontSize: '11px', color: 'var(--text-2)' }}>{d.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── History table ────────────────────────────────────────────────────────────

function HistoryTable({ history, currentMonth, baseCurrency }: { history: MonthlySnapshot[]; currentMonth: string; baseCurrency: string }) {
  function pill(value: number, good: number, bad: number) {
    const bg    = value >= good ? 'rgba(22,163,74,0.12)'  : value >= bad ? 'rgba(217,119,6,0.12)'  : 'rgba(220,38,38,0.1)'
    const color = value >= good ? 'var(--success)'        : value >= bad ? 'var(--warning)'        : 'var(--danger)'
    return (
      <span className="badge" style={{ background: bg, color, fontSize: '10px' }}>{value.toFixed(1)}%</span>
    )
  }

  const columns = ['Month', 'Cash in', 'Contracted', 'Clients signed', 'Calls booked', 'Show-up %', 'Close %', 'Avg deal size']

  return (
    <div style={{ background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: 'var(--radius-panel)', padding: '20px', boxShadow: 'var(--shadow-card)' }}>
      <h2 className="section-title" style={{ marginBottom: '16px' }}>Monthly history</h2>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', minWidth: '720px', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {columns.map((h, i) => (
                <th key={h} className="label-caps" style={{ paddingBottom: '10px', textAlign: i > 0 ? 'right' : 'left', fontWeight: '500', borderBottom: '1px solid var(--border)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {history.map(s => {
              const isCurrent = s.month === currentMonth
              const avgDeal = s.clients_signed > 0 ? fmtCurrency(s.revenue_contracted / s.clients_signed, baseCurrency) : '—'
              return (
                <tr
                  key={s.month}
                  style={{
                    background:   isCurrent ? 'rgba(37,99,235,0.04)' : 'transparent',
                    borderBottom: '1px solid var(--border)',
                    transition:   'background 80ms ease',
                    fontWeight:   isCurrent ? '600' : '400',
                  }}
                  onMouseEnter={e => { if (!isCurrent) (e.currentTarget as HTMLTableRowElement).style.background = 'var(--surface-2)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLTableRowElement).style.background = isCurrent ? 'rgba(37,99,235,0.04)' : 'transparent' }}
                >
                  <td style={{ padding: '10px 12px 10px 0', fontSize: '12px', color: 'var(--text-1)', whiteSpace: 'nowrap' }}>
                    {fmtMonth(s.month)}
                    {isCurrent && (
                      <span className="badge" style={{ background: 'rgba(37,99,235,0.1)', color: 'var(--accent)', fontSize: '9px', marginLeft: '6px' }}>LIVE</span>
                    )}
                  </td>
                  <td style={{ padding: '10px 12px', fontSize: '12px', color: 'var(--text-1)', textAlign: 'right' }}>{fmtCurrency(s.cash_collected, baseCurrency)}</td>
                  <td style={{ padding: '10px 12px', fontSize: '12px', color: 'var(--text-1)', textAlign: 'right' }}>{fmtCurrency(s.revenue_contracted, baseCurrency)}</td>
                  <td style={{ padding: '10px 12px', fontSize: '12px', color: 'var(--text-1)', textAlign: 'right' }}>{s.clients_signed}</td>
                  <td style={{ padding: '10px 12px', fontSize: '12px', color: 'var(--text-1)', textAlign: 'right' }}>{s.meetings_booked}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right' }}>{pill(s.show_up_rate, 70, 50)}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right' }}>{pill(s.close_rate, 30, 15)}</td>
                  <td style={{ padding: '10px 12px', fontSize: '12px', color: 'var(--text-1)', textAlign: 'right' }}>{avgDeal}</td>
                </tr>
              )
            })}
            {history.length === 0 && (
              <tr>
                <td colSpan={8} style={{ padding: '32px 0', textAlign: 'center', fontSize: '13px', color: 'var(--text-3)' }}>
                  No history yet. Data will appear at the end of each month.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function NumbersClient({
  baseCurrency, targets, currentSnapshot, lastMonthSnapshot, history,
  clients, installments, currentMonth, expenses, adSpendTotal,
  monthlyRevenueDue, totalContracted, totalCashCollected,
  totalOutstanding, cashPending, leadsReplied,
}: Props) {
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

  // Swipe support for month navigation
  const touchStartX = useRef<number | null>(null)
  function handleTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX
  }
  function handleTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null) return
    const dx = e.changedTouches[0].clientX - touchStartX.current
    touchStartX.current = null
    if (Math.abs(dx) < 40) return
    if (dx < 0 && canGoBack) setSelectedMonth(availableMonths[selectedIdx + 1])
    if (dx > 0 && canGoForward) setSelectedMonth(availableMonths[selectedIdx - 1])
  }

  const NAV_BTN_STYLE = {
    width: '32px',
    height: '32px',
    borderRadius: 'var(--radius-btn)',
    background: 'var(--surface-2)',
    border: '1px solid var(--border)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--text-2)',
    transition: 'background 120ms ease, color 120ms ease',
  } as const

  // ── Derived values ─────────────────────────────────────────────────────────
  const avgDeal     = snap?.clients_signed ? (snap.revenue_contracted / snap.clients_signed) : 0
  const lastAvgDeal = last?.clients_signed ? (last.revenue_contracted / last.clients_signed) : null

  const activePlanCount = clients.filter(c => c.payment_type === 'plan' || c.payment_type === 'split').length

  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0)

  // ROAS values
  const cashRoas    = adSpendTotal > 0 ? (snap?.cash_collected ?? 0) / adSpendTotal : null
  const revenueRoas = adSpendTotal > 0 ? (snap?.revenue_contracted ?? 0) / adSpendTotal : null
  const profitRoas  = adSpendTotal > 0 ? ((snap?.cash_collected ?? 0) - (totalExpenses + adSpendTotal)) / adSpendTotal : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>

      {/* ── Top bar ───────────────────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 24px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--surface-1)',
          gap: '12px',
          flexWrap: 'wrap',
          flexShrink: 0,
          position: 'sticky',
          top: 0,
          zIndex: 10,
        }}
      >
        {/* Month navigation */}
        <div
          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <button
            onClick={() => canGoBack && setSelectedMonth(availableMonths[selectedIdx + 1])}
            disabled={!canGoBack}
            style={{ ...NAV_BTN_STYLE, opacity: canGoBack ? 1 : 0.3, cursor: canGoBack ? 'pointer' : 'not-allowed' }}
            onMouseEnter={e => { if (canGoBack) { (e.currentTarget as HTMLButtonElement).style.background = 'var(--surface-3)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-1)' } }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--surface-2)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-2)' }}
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
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '5px 10px',
              background: 'var(--surface-2)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-btn)',
              cursor: 'pointer',
              userSelect: 'none',
              minWidth: '164px',
              justifyContent: 'center',
            }}>
              <span style={{ fontSize: '14px', fontWeight: 600, letterSpacing: '-0.01em', color: 'var(--text-1)' }}>
                {fmtMonth(selectedMonth)}
              </span>
              {selectedMonth === currentMonth && (
                <span className="badge" style={{ background: 'rgba(37,99,235,0.1)', color: 'var(--accent)', fontSize: '9px' }}>LIVE</span>
              )}
              <svg viewBox="0 0 20 20" fill="currentColor" width="12" height="12" style={{ color: 'var(--text-3)', flexShrink: 0 }}>
                <path fillRule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
              </svg>
            </div>
          </div>

          <button
            onClick={() => canGoForward && setSelectedMonth(availableMonths[selectedIdx - 1])}
            disabled={!canGoForward}
            style={{ ...NAV_BTN_STYLE, opacity: canGoForward ? 1 : 0.3, cursor: canGoForward ? 'pointer' : 'not-allowed' }}
            onMouseEnter={e => { if (canGoForward) { (e.currentTarget as HTMLButtonElement).style.background = 'var(--surface-3)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-1)' } }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--surface-2)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-2)' }}
            title="Next month"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14">
              <path fillRule="evenodd" d="M8.22 5.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06-1.06L11.94 10 8.22 6.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        {/* Compare mode switcher */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '2px', background: 'var(--surface-2)', borderRadius: 'var(--radius-btn)', padding: '3px' }}>
          <button
            onClick={() => setCompareMode('targets')}
            style={{
              padding: '4px 12px',
              borderRadius: '5px',
              fontSize: '11px',
              fontWeight: compareMode === 'targets' ? '500' : '400',
              color: compareMode === 'targets' ? 'var(--text-1)' : 'var(--text-2)',
              background: compareMode === 'targets' ? 'var(--surface-1)' : 'transparent',
              border: 'none',
              cursor: 'pointer',
              boxShadow: compareMode === 'targets' ? 'var(--shadow-card)' : 'none',
              transition: 'all 120ms ease',
            }}
          >
            vs my targets
          </button>
          {lastMonthLocked ? (
            <div style={{ position: 'relative' }} className="group">
              <button
                onClick={() => setShowUnlockModal(true)}
                style={{
                  padding: '4px 12px',
                  borderRadius: '5px',
                  fontSize: '11px',
                  color: 'var(--text-3)',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'not-allowed',
                  opacity: 0.5,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '3px',
                }}
              >
                vs last month
                <svg viewBox="0 0 16 16" fill="currentColor" width="10" height="10">
                  <path fillRule="evenodd" d="M8 1a3.5 3.5 0 0 0-3.5 3.5V6H4a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V7a1 1 0 0 0-1-1h-.5V4.5A3.5 3.5 0 0 0 8 1Zm2 5V4.5a2 2 0 1 0-4 0V6h4Z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          ) : (
            <button
              onClick={() => setCompareMode('last_month')}
              style={{
                padding: '4px 12px',
                borderRadius: '5px',
                fontSize: '11px',
                fontWeight: compareMode === 'last_month' ? '500' : '400',
                color: compareMode === 'last_month' ? 'var(--text-1)' : 'var(--text-2)',
                background: compareMode === 'last_month' ? 'var(--surface-1)' : 'transparent',
                border: 'none',
                cursor: 'pointer',
                boxShadow: compareMode === 'last_month' ? 'var(--shadow-card)' : 'none',
                transition: 'all 120ms ease',
              }}
            >
              vs last month
            </button>
          )}
        </div>
      </div>

      {/* ── Unlock modal ──────────────────────────────────────────────────── */}
      {showUnlockModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)', padding: '16px' }}>
          <div className="modal-enter" style={{ background: 'var(--surface-1)', borderRadius: 'var(--radius-panel)', boxShadow: 'var(--shadow-dropdown)', width: '100%', maxWidth: '360px', padding: '24px' }}>
            <h2 className="section-title" style={{ marginBottom: '8px' }}>Unlock month-on-month comparison</h2>
            <p style={{ fontSize: '13px', color: 'var(--text-2)', marginBottom: '20px' }}>
              Have you already tracked your numbers from last month manually? If so, tap Confirm and we&apos;ll let you compare.
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

      {/* ── Body ─────────────────────────────────────────────────────────── */}
      <div style={{ padding: '20px 24px 40px', display: 'flex', flexDirection: 'column', gap: '32px' }}>

        {/* No last month data notice */}
        {compareMode === 'last_month' && last === null && (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '12px 14px', background: 'rgba(37,99,235,0.05)', border: '1px solid rgba(37,99,235,0.15)', borderRadius: 'var(--radius-card)', fontSize: '13px', color: 'var(--accent)' }}>
            <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14" style={{ flexShrink: 0, marginTop: '2px' }}>
              <path fillRule="evenodd" d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-7-4a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM9 9a.75.75 0 0 0 0 1.5h.253a.25.25 0 0 1 .244.304l-.459 2.066A1.75 1.75 0 0 0 10.747 15H11a.75.75 0 0 0 0-1.5h-.253a.25.25 0 0 1-.244-.304l.459-2.066A1.75 1.75 0 0 0 9.253 9H9Z" clipRule="evenodd" />
            </svg>
            No last month data yet. Numbers will appear once you have a full month recorded.
          </div>
        )}

        {/* ── All-time overview (static — shows current state of the business) */}
        <div>
          <p style={{ fontSize: '11px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-3)', marginBottom: '10px' }}>
            All time
          </p>
          <div className="grid grid-cols-3" style={{ gap: '10px' }}>
            {([
              { label: 'Total contracted', value: totalContracted,    accent: 'var(--success)',  sub: `${clients.filter(c => c.active !== false).length} active clients` },
              { label: 'Total collected',  value: totalCashCollected, accent: '#3B82F6',         sub: `${totalContracted > 0 ? Math.round((totalCashCollected / totalContracted) * 100) : 0}% of contracted` },
              { label: 'Outstanding',      value: totalOutstanding,   accent: 'var(--warning)',  sub: `from ${activePlanCount} active plan${activePlanCount !== 1 ? 's' : ''}` },
            ] as { label: string; value: number; accent: string; sub: string }[]).map(s => (
              <div key={s.label} style={{ background: 'var(--surface-1)', border: '1px solid var(--border)', borderLeft: `3px solid ${s.accent}`, borderRadius: 'var(--radius-card)', padding: '14px 16px', boxShadow: 'var(--shadow-card)' }}>
                <p style={{ fontSize: '11px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-3)', marginBottom: '6px' }}>{s.label}</p>
                <p style={{ fontSize: '22px', fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--text-1)', lineHeight: 1, marginBottom: '4px' }}>{fmtCurrency(s.value, baseCurrency)}</p>
                <p style={{ fontSize: '11px', color: 'var(--text-2)' }}>{s.sub}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Section 1: This month's money ─────────────────────────────── */}
        <div>
          <p style={{ fontSize: '11px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-3)', marginBottom: '10px' }}>
            {fmtMonth(selectedMonth)}
          </p>
          <div className="grid grid-cols-2 lg:grid-cols-4" style={{ gap: '10px' }}>

            {/* Revenue due — the "expected" number for this month */}
            <KpiCard
              label="Revenue"
              value={selectedMonth === currentMonth ? monthlyRevenueDue : snap?.cash_collected ?? 0}
              displayValue={fmtCurrency(selectedMonth === currentMonth ? monthlyRevenueDue : snap?.cash_collected ?? 0, baseCurrency)}
              target={getTarget('cash_target')}
              targetDisplay={targets?.cash_target ? fmtCurrency(targets.cash_target, baseCurrency) : undefined}
              compareMode={compareMode}
              lastValue={last?.cash_collected ?? null}
              lastDisplay={last?.cash_collected != null ? fmtCurrency(last.cash_collected, baseCurrency) : undefined}
              color={score(selectedMonth === currentMonth ? monthlyRevenueDue : snap?.cash_collected ?? 0, compareMode === 'targets' ? targets?.cash_target : last?.cash_collected)}
              overrideAccent="var(--success)"
              isCurrency
              currency={baseCurrency}
              hero
              subline="Total expected this month"
            />

            {/* Cash collected — what's actually been received */}
            <KpiCard
              label="Cash collected"
              value={snap?.cash_collected ?? 0}
              displayValue={fmtCurrency(snap?.cash_collected ?? 0, baseCurrency)}
              compareMode={compareMode}
              lastValue={last?.cash_collected ?? null}
              overrideAccent="#3B82F6"
              isCurrency
              currency={baseCurrency}
              hero
              subline={selectedMonth === currentMonth
                ? `${monthlyRevenueDue > 0 ? Math.round(((snap?.cash_collected ?? 0) / monthlyRevenueDue) * 100) : 0}% of revenue received`
                : 'Collected this month'}
            />

            {/* Pending — still to be marked paid */}
            <KpiCard
              label="Pending"
              value={selectedMonth === currentMonth ? cashPending : 0}
              displayValue={selectedMonth === currentMonth && cashPending > 0
                ? fmtCurrency(cashPending, baseCurrency)
                : '—'}
              compareMode={compareMode}
              overrideAccent={selectedMonth === currentMonth && cashPending > 0 ? 'var(--warning)' : 'var(--border-strong)'}
              isCurrency
              currency={baseCurrency}
              hero
              subline={selectedMonth === currentMonth && cashPending > 0
                ? 'Still to collect this month'
                : selectedMonth === currentMonth ? 'All payments received ✓' : 'Month closed'}
            />

            {/* New deals — contract value of clients signed this month */}
            <KpiCard
              label="New deals"
              value={snap?.revenue_contracted ?? 0}
              displayValue={snap?.revenue_contracted ? fmtCurrency(snap.revenue_contracted, baseCurrency) : '—'}
              target={getTarget('revenue_target')}
              targetDisplay={targets?.revenue_target ? fmtCurrency(targets.revenue_target, baseCurrency) : undefined}
              compareMode={compareMode}
              lastValue={last?.revenue_contracted ?? null}
              lastDisplay={last?.revenue_contracted != null ? fmtCurrency(last.revenue_contracted, baseCurrency) : undefined}
              color={score(snap?.revenue_contracted ?? 0, compareMode === 'targets' ? targets?.revenue_target : last?.revenue_contracted)}
              overrideAccent="#8B5CF6"
              isCurrency
              currency={baseCurrency}
              hero
              subline={snap?.clients_signed
                ? `${snap.clients_signed} new client${snap.clients_signed !== 1 ? 's' : ''} signed`
                : 'No new clients this month'}
            />
          </div>
        </div>

        {/* ── Section 2: Sales performance ──────────────────────────────── */}
        <div>
          <p style={{ fontSize: '11px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-3)', marginBottom: '10px' }}>Sales performance</p>
          <div className="grid grid-cols-2 lg:grid-cols-3" style={{ gap: '10px' }}>

            {/* Calls booked */}
            <KpiCard
              label="Calls booked"
              value={snap?.meetings_booked ?? 0}
              displayValue={String(snap?.meetings_booked ?? 0)}
              target={getTarget('meetings_target')}
              targetDisplay={targets?.meetings_target ? String(targets.meetings_target) : undefined}
              compareMode={compareMode}
              lastValue={last?.meetings_booked ?? null}
              lastDisplay={last?.meetings_booked != null ? String(last.meetings_booked) : undefined}
              color={score(snap?.meetings_booked ?? 0, compareMode === 'targets' ? targets?.meetings_target : last?.meetings_booked)}
            />

            {/* Show-up rate */}
            <KpiCard
              label="Show-up rate"
              value={snap?.show_up_rate ?? 0}
              displayValue={`${(snap?.show_up_rate ?? 0).toFixed(1)}%`}
              target={getTarget('show_up_target')}
              targetDisplay={targets?.show_up_target ? `${targets.show_up_target}%` : undefined}
              compareMode={compareMode}
              lastValue={last?.show_up_rate ?? null}
              lastDisplay={last?.show_up_rate != null ? `${last.show_up_rate.toFixed(1)}%` : undefined}
              color={score(snap?.show_up_rate ?? 0, compareMode === 'targets' ? targets?.show_up_target : last?.show_up_rate)}
              isPercent
            />

            {/* Close rate */}
            <KpiCard
              label="Close rate"
              value={snap?.close_rate ?? 0}
              displayValue={`${(snap?.close_rate ?? 0).toFixed(1)}%`}
              target={getTarget('close_rate_target')}
              targetDisplay={targets?.close_rate_target ? `${targets.close_rate_target}%` : undefined}
              compareMode={compareMode}
              lastValue={last?.close_rate ?? null}
              lastDisplay={last?.close_rate != null ? `${last.close_rate.toFixed(1)}%` : undefined}
              color={score(snap?.close_rate ?? 0, compareMode === 'targets' ? targets?.close_rate_target : last?.close_rate)}
              isPercent
              numSize={30}
            />
          </div>
        </div>

        {/* ── Section 3: Growth ─────────────────────────────────────────── */}
        <div>
          <p style={{ fontSize: '11px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-3)', marginBottom: '10px' }}>Growth</p>
          <div className="grid grid-cols-2 lg:grid-cols-3" style={{ gap: '10px' }}>

            {/* New followers */}
            <KpiCard
              label="New followers"
              value={snap?.new_followers ?? 0}
              displayValue={String(snap?.new_followers ?? 0)}
              target={getTarget('followers_target')}
              targetDisplay={targets?.followers_target ? String(targets.followers_target) : undefined}
              compareMode={compareMode}
              lastValue={last?.new_followers ?? null}
              lastDisplay={last?.new_followers != null ? String(last.new_followers) : undefined}
              color={score(snap?.new_followers ?? 0, compareMode === 'targets' ? targets?.followers_target : last?.new_followers)}
            />

            {/* Leads replied */}
            <KpiCard
              label="Leads replied"
              value={leadsReplied}
              displayValue={String(leadsReplied)}
              compareMode={compareMode}
              color="neutral"
            />

            {/* Avg deal size */}
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
            />
          </div>
        </div>

        {/* ── ROAS ──────────────────────────────────────────────────────── */}
        <div style={{ background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: 'var(--radius-card)', padding: '20px 18px', boxShadow: 'var(--shadow-card)' }}>
          <p style={{ fontSize: '11px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-3)', marginBottom: '14px' }}>ROAS</p>

          {adSpendTotal === 0 ? (
            <p style={{ fontSize: '13px', color: 'var(--text-2)' }}>
              Add your ad spend in Settings to see your ROAS
            </p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr' }}>
              {[
                {
                  label: 'Cash ROAS',
                  value: cashRoas,
                  formula: 'cash_collected / ad_spend',
                },
                {
                  label: 'Revenue ROAS',
                  value: revenueRoas,
                  formula: 'revenue_contracted / ad_spend',
                },
                {
                  label: 'Profit ROAS',
                  value: profitRoas,
                  formula: '(cash − expenses) / ad_spend',
                },
              ].map((col, i) => (
                <div
                  key={col.label}
                  style={{
                    padding: '0 16px',
                    borderRight: i < 2 ? '1px solid var(--border)' : 'none',
                    borderLeft: i === 0 ? 'none' : undefined,
                    paddingLeft: i === 0 ? 0 : '16px',
                  }}
                >
                  <p style={{ fontSize: '11px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-3)', marginBottom: '6px' }}>{col.label}</p>
                  <p style={{ fontSize: '36px', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text-1)', lineHeight: 1 }}>
                    {col.value != null ? `${col.value.toFixed(2)}x` : '—'}
                  </p>
                  <p style={{ fontSize: '11px', fontFamily: 'monospace', color: 'var(--text-3)', marginTop: '6px' }}>{col.formula}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Revenue chart ─────────────────────────────────────────────── */}
        <div style={{ background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: 'var(--radius-panel)', padding: '20px', boxShadow: 'var(--shadow-card)' }}>
          <h2 className="section-title" style={{ marginBottom: '16px' }}>Performance over time</h2>
          <RevenueChart
            history={[
              ...history.filter(s => s.month !== currentMonth),
              ...(currentSnapshot ? [currentSnapshot] : []),
            ]}
            baseCurrency={baseCurrency}
          />
        </div>

        {/* ── Monthly history ───────────────────────────────────────────── */}
        <HistoryTable
          history={[
            ...(currentSnapshot ? [currentSnapshot] : []),
            ...history.filter(s => s.month !== currentMonth),
          ]}
          currentMonth={currentMonth}
          baseCurrency={baseCurrency}
        />

        {/* ── Payment tracker ───────────────────────────────────────────── */}
        <PaymentTracker clients={clients} installments={installments} baseCurrency={baseCurrency} />

        {/* ── Expenses & profit ─────────────────────────────────────────── */}
        <ExpensesSection
          expenses={expenses}
          adSpendTotal={adSpendTotal}
          currency={baseCurrency}
          currentMonth={currentMonth}
          cashCollected={snap?.cash_collected ?? 0}
        />
      </div>
    </div>
  )
}
