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
  totalActiveClients: number
  totalContracted: number
  totalCashCollected: number
  totalOutstanding: number
}

type CompareMode = 'targets' | 'last_month'
type ScoreColor  = 'green' | 'amber' | 'red' | 'neutral'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat('en', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount)
}

function formatMonth(month: string) {
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

// ─── KPI card ─────────────────────────────────────────────────────────────────

function KpiCard({
  label, value, displayValue, target, targetDisplay, compareMode, compareValue,
  unit = '', color = 'neutral',
}: {
  label: string
  value: number
  displayValue: string
  target?: number | null
  targetDisplay?: string
  compareMode: CompareMode
  compareValue?: number | null
  unit?: string
  color?: ScoreColor
}) {
  const accent = SCORE_ACCENT[color]
  const textColor = SCORE_TEXT[color]
  const pct = target ? Math.min((value / target) * 100, 100) : 0
  const showComparison = target || compareValue != null

  const diff = compareMode === 'targets'
    ? target ? `${Math.round((value / target) * 100)}% of target` : null
    : compareValue != null
      ? (value > compareValue
          ? `+${(value - compareValue).toFixed(1)}${unit} vs last month`
          : `${(value - compareValue).toFixed(1)}${unit} vs last month`)
      : null

  return (
    <div
      style={{
        background: 'var(--surface-1)',
        border: '1px solid var(--border)',
        borderLeft: `3px solid ${accent}`,
        borderRadius: 'var(--radius-card)',
        padding: '14px 16px',
        boxShadow: 'var(--shadow-card)',
      }}
    >
      <p className="label-caps" style={{ marginBottom: '6px' }}>{label}</p>
      <p className="hero-num" style={{ marginBottom: showComparison ? '8px' : 0 }}>{displayValue}</p>

      {showComparison && (
        <>
          {diff && (
            <p style={{ fontSize: '11px', fontWeight: '500', color: textColor, marginBottom: '6px' }}>{diff}</p>
          )}
          {target && (
            <div
              style={{
                width: '100%',
                height: '3px',
                background: 'var(--surface-3)',
                borderRadius: '99px',
                overflow: 'hidden',
                marginBottom: '5px',
              }}
            >
              <div style={{ height: '100%', borderRadius: '99px', background: accent, width: `${pct}%`, transition: 'width 400ms ease' }} />
            </div>
          )}
          {targetDisplay && (
            <p style={{ fontSize: '11px', color: 'var(--text-3)' }}>
              {compareMode === 'targets' ? `Target: ${targetDisplay}` : `Last month: ${targetDisplay}`}
            </p>
          )}
        </>
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
                <p style={{ fontSize: '11px', color: 'var(--text-3)' }}>{formatCurrency(collected, baseCurrency)} collected</p>
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

  return (
    <div style={{ background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: 'var(--radius-panel)', padding: '20px', boxShadow: 'var(--shadow-card)' }}>
      <h2 className="section-title" style={{ marginBottom: '16px' }}>Monthly history</h2>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', minWidth: '700px', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['Month', 'Cash in', 'Contracted', 'Followers', 'Meetings', 'Show-up', 'Close rate', 'Signed'].map((h, i) => (
                <th key={h} className="label-caps" style={{ paddingBottom: '10px', textAlign: i > 0 ? 'right' : 'left', fontWeight: '500', borderBottom: '1px solid var(--border)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {history.map(s => (
              <tr
                key={s.month}
                style={{
                  background: s.month === currentMonth ? 'rgba(37,99,235,0.04)' : 'transparent',
                  borderBottom: '1px solid var(--border)',
                  transition: 'background 80ms ease',
                }}
                onMouseEnter={e => { if (s.month !== currentMonth) (e.currentTarget as HTMLTableRowElement).style.background = 'var(--surface-2)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLTableRowElement).style.background = s.month === currentMonth ? 'rgba(37,99,235,0.04)' : 'transparent' }}
              >
                <td style={{ padding: '10px 12px 10px 0', fontSize: '12px', fontWeight: '500', color: 'var(--text-1)', whiteSpace: 'nowrap' }}>
                  {formatMonth(s.month)}
                  {s.month === currentMonth && (
                    <span className="badge" style={{ background: 'rgba(37,99,235,0.1)', color: 'var(--accent)', fontSize: '9px', marginLeft: '6px' }}>LIVE</span>
                  )}
                </td>
                <td style={{ padding: '10px 12px', fontSize: '12px', color: 'var(--text-1)', textAlign: 'right' }}>{formatCurrency(s.cash_collected, baseCurrency)}</td>
                <td style={{ padding: '10px 12px', fontSize: '12px', color: 'var(--text-1)', textAlign: 'right' }}>{formatCurrency(s.revenue_contracted, baseCurrency)}</td>
                <td style={{ padding: '10px 12px', fontSize: '12px', color: 'var(--text-1)', textAlign: 'right' }}>{s.new_followers}</td>
                <td style={{ padding: '10px 12px', fontSize: '12px', color: 'var(--text-1)', textAlign: 'right' }}>{s.meetings_booked}</td>
                <td style={{ padding: '10px 12px', textAlign: 'right' }}>{pill(s.show_up_rate, 70, 50)}</td>
                <td style={{ padding: '10px 12px', textAlign: 'right' }}>{pill(s.close_rate, 30, 15)}</td>
                <td style={{ padding: '10px 12px', fontSize: '12px', fontWeight: '600', color: 'var(--text-1)', textAlign: 'right' }}>{s.clients_signed}</td>
              </tr>
            ))}
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
  totalActiveClients, totalContracted, totalCashCollected, totalOutstanding,
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

  function getCompare<K extends keyof MonthlySnapshot>(key: K): number | null {
    if (compareMode === 'targets') return null
    return last ? (last[key] as number) : null
  }

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
    if (Math.abs(dx) < 40) return // too short, ignore
    if (dx < 0 && canGoBack) setSelectedMonth(availableMonths[selectedIdx + 1])   // swipe left → older
    if (dx > 0 && canGoForward) setSelectedMonth(availableMonths[selectedIdx - 1]) // swipe right → newer
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

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
        }}
      >
        {/* Month navigation — arrows + tap month label to get dropdown, swipe on mobile */}
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

          {/* Month label — click to show select dropdown */}
          <div style={{ position: 'relative' }}>
            <select
              value={selectedMonth}
              onChange={e => setSelectedMonth(e.target.value)}
              style={{
                position: 'absolute',
                inset: 0,
                opacity: 0,
                cursor: 'pointer',
                width: '100%',
                height: '100%',
              }}
              aria-label="Jump to month"
            >
              {availableMonths.map(m => (
                <option key={m} value={m}>{formatMonth(m)}</option>
              ))}
            </select>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
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
                {formatMonth(selectedMonth)}
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
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '2px',
            background: 'var(--surface-2)',
            borderRadius: 'var(--radius-btn)',
            padding: '3px',
          }}
        >
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
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 50,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.5)', padding: '16px',
          }}
        >
          <div
            className="modal-enter"
            style={{
              background: 'var(--surface-1)', borderRadius: 'var(--radius-panel)',
              boxShadow: 'var(--shadow-dropdown)', width: '100%', maxWidth: '360px', padding: '24px',
            }}
          >
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
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px 40px', display: 'flex', flexDirection: 'column', gap: '32px' }}>

        {/* No last month data notice */}
        {compareMode === 'last_month' && last === null && (
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '10px',
              padding: '12px 14px',
              background: 'rgba(37,99,235,0.05)',
              border: '1px solid rgba(37,99,235,0.15)',
              borderRadius: 'var(--radius-card)',
              fontSize: '13px',
              color: 'var(--accent)',
            }}
          >
            <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14" style={{ flexShrink: 0, marginTop: '2px' }}>
              <path fillRule="evenodd" d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-7-4a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM9 9a.75.75 0 0 0 0 1.5h.253a.25.25 0 0 1 .244.304l-.459 2.066A1.75 1.75 0 0 0 10.747 15H11a.75.75 0 0 0 0-1.5h-.253a.25.25 0 0 1-.244-.304l.459-2.066A1.75 1.75 0 0 0 9.253 9H9Z" clipRule="evenodd" />
            </svg>
            No last month data yet. Numbers will appear once you have a full month recorded.
          </div>
        )}

        {/* ── Current business overview ─────────────────────────────────── */}
        <div>
          <p className="label-caps" style={{ marginBottom: '10px' }}>Current business</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }} className="lg:grid-cols-4">
            {[
              { label: 'Active clients',    value: String(totalActiveClients),                   accent: 'var(--accent)' },
              { label: 'Total contracted',  value: formatCurrency(totalContracted, baseCurrency), accent: 'var(--success)' },
              { label: 'Cash collected',    value: formatCurrency(totalCashCollected, baseCurrency), accent: 'var(--success)' },
              { label: 'Outstanding',       value: formatCurrency(totalOutstanding, baseCurrency), accent: totalOutstanding > 0 ? 'var(--warning)' : 'var(--border-strong)' },
            ].map(s => (
              <div
                key={s.label}
                style={{
                  background: 'var(--surface-2)',
                  borderRadius: 'var(--radius-card)',
                  padding: '12px 14px',
                  borderLeft: `3px solid ${s.accent}`,
                }}
              >
                <p className="label-caps" style={{ marginBottom: '4px' }}>{s.label}</p>
                <p className="hero-num" style={{ fontSize: '20px' }}>{s.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Monthly KPIs ──────────────────────────────────────────────── */}
        <div>
          <p className="label-caps" style={{ marginBottom: '10px' }}>{formatMonth(selectedMonth)}</p>

          {/* Primary KPIs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', marginBottom: '10px' }} className="lg:grid-cols-3">
            <KpiCard
              label="Cash collected"
              value={snap?.cash_collected ?? 0}
              displayValue={formatCurrency(snap?.cash_collected ?? 0, baseCurrency)}
              target={getTarget('cash_target')}
              targetDisplay={targets?.cash_target ? formatCurrency(targets.cash_target, baseCurrency) : undefined}
              compareMode={compareMode}
              compareValue={getCompare('cash_collected')}
              color={score(snap?.cash_collected ?? 0, compareMode === 'targets' ? targets?.cash_target : last?.cash_collected)}
            />
            <KpiCard
              label="Revenue contracted"
              value={snap?.revenue_contracted ?? 0}
              displayValue={formatCurrency(snap?.revenue_contracted ?? 0, baseCurrency)}
              target={getTarget('revenue_target')}
              targetDisplay={targets?.revenue_target ? formatCurrency(targets.revenue_target, baseCurrency) : undefined}
              compareMode={compareMode}
              compareValue={getCompare('revenue_contracted')}
              color={score(snap?.revenue_contracted ?? 0, compareMode === 'targets' ? targets?.revenue_target : last?.revenue_contracted)}
            />
            <KpiCard
              label="New followers"
              value={snap?.new_followers ?? 0}
              displayValue={String(snap?.new_followers ?? 0)}
              target={getTarget('followers_target')}
              targetDisplay={targets?.followers_target ? String(targets.followers_target) : undefined}
              compareMode={compareMode}
              compareValue={getCompare('new_followers')}
              color={score(snap?.new_followers ?? 0, compareMode === 'targets' ? targets?.followers_target : last?.new_followers)}
            />
            <KpiCard
              label="Meetings booked"
              value={snap?.meetings_booked ?? 0}
              displayValue={String(snap?.meetings_booked ?? 0)}
              target={getTarget('meetings_target')}
              targetDisplay={targets?.meetings_target ? String(targets.meetings_target) : undefined}
              compareMode={compareMode}
              compareValue={getCompare('meetings_booked')}
              color={score(snap?.meetings_booked ?? 0, compareMode === 'targets' ? targets?.meetings_target : last?.meetings_booked)}
            />
            <KpiCard
              label="Close rate"
              value={snap?.close_rate ?? 0}
              displayValue={`${(snap?.close_rate ?? 0).toFixed(1)}%`}
              target={getTarget('close_rate_target')}
              targetDisplay={targets?.close_rate_target ? `${targets.close_rate_target}%` : undefined}
              compareMode={compareMode}
              compareValue={getCompare('close_rate')}
              unit="%"
              color={score(snap?.close_rate ?? 0, compareMode === 'targets' ? targets?.close_rate_target : last?.close_rate)}
            />
          </div>

          {/* Supporting KPIs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }} className="lg:grid-cols-3">
            <KpiCard
              label="Show-up rate"
              value={snap?.show_up_rate ?? 0}
              displayValue={`${(snap?.show_up_rate ?? 0).toFixed(1)}%`}
              target={getTarget('show_up_target')}
              targetDisplay={targets?.show_up_target ? `${targets.show_up_target}%` : undefined}
              compareMode={compareMode}
              compareValue={getCompare('show_up_rate')}
              unit="%"
              color={score(snap?.show_up_rate ?? 0, compareMode === 'targets' ? targets?.show_up_target : last?.show_up_rate)}
            />
            <KpiCard
              label="No-show rate"
              value={snap?.no_show_rate ?? 0}
              displayValue={`${(snap?.no_show_rate ?? 0).toFixed(1)}%`}
              compareMode={compareMode}
              compareValue={getCompare('no_show_rate')}
              unit="%"
              color="neutral"
            />
            <KpiCard
              label="Cancellation rate"
              value={snap?.cancellation_rate ?? 0}
              displayValue={`${(snap?.cancellation_rate ?? 0).toFixed(1)}%`}
              compareMode={compareMode}
              compareValue={getCompare('cancellation_rate')}
              unit="%"
              color="neutral"
            />
          </div>
        </div>

        {/* ── Revenue chart ──────────────────────────────────────────────── */}
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

        {/* ── Monthly history ────────────────────────────────────────────── */}
        <HistoryTable
          history={[
            ...(currentSnapshot ? [currentSnapshot] : []),
            ...history.filter(s => s.month !== currentMonth),
          ]}
          currentMonth={currentMonth}
          baseCurrency={baseCurrency}
        />

        {/* ── Payment tracker ────────────────────────────────────────────── */}
        <PaymentTracker clients={clients} installments={installments} baseCurrency={baseCurrency} />

        {/* ── Expenses & profit ──────────────────────────────────────────── */}
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
