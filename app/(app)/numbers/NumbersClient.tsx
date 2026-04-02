'use client'

import { useState } from 'react'
import type { KpiTargets, MonthlySnapshot, Client, PaymentInstallment, Expense } from '@/types'
import RevenueChart from '@/components/numbers/RevenueChart'
import ExpensesSection from './ExpensesSection'

// ─── Lock icon ────────────────────────────────────────────────────────────────

function LockIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3 inline-block ml-1">
      <path fillRule="evenodd" d="M8 1a3.5 3.5 0 0 0-3.5 3.5V6H4a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V7a1 1 0 0 0-1-1h-.5V4.5A3.5 3.5 0 0 0 8 1Zm2 5V4.5a2 2 0 1 0-4 0V6h4Z" clipRule="evenodd" />
    </svg>
  )
}

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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat('en', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount)
}

function formatMonth(month: string) {
  const [y, m] = month.split('-')
  return new Date(Number(y), Number(m) - 1).toLocaleDateString('en', { month: 'long', year: 'numeric' })
}

type ScoreColor = 'green' | 'amber' | 'red' | 'neutral'

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

const SCORE_COLORS: Record<ScoreColor, { border: string; text: string; bg: string }> = {
  green:   { border: 'border-l-green-500',  text: 'text-green-600',  bg: 'bg-green-500'  },
  amber:   { border: 'border-l-amber-400',  text: 'text-amber-600',  bg: 'bg-amber-400'  },
  red:     { border: 'border-l-red-500',    text: 'text-red-600',    bg: 'bg-red-500'    },
  neutral: { border: 'border-l-gray-200',   text: 'text-gray-500',   bg: 'bg-gray-300'   },
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
  const c = SCORE_COLORS[color]
  const pct = target ? Math.min((value / target) * 100, 100) : 0
  const showComparison = target || compareValue != null

  const diff = compareMode === 'targets'
    ? target ? `${Math.round((value / target) * 100)}% of target` : null
    : compareValue != null ? (value > compareValue ? `+${(value - compareValue).toFixed(1)}${unit} vs last month` : `${(value - compareValue).toFixed(1)}${unit} vs last month`) : null

  return (
    <div className={`bg-white dark:bg-slate-800 rounded-xl border border-l-4 border-gray-100 dark:border-slate-700 ${c.border} p-4`}>
      <p className="text-xs text-gray-500 dark:text-slate-400 font-medium mb-1">{label}</p>
      <p className="text-2xl font-bold text-gray-900 dark:text-slate-100 mb-1">{displayValue}</p>

      {showComparison && (
        <>
          {diff && <p className={`text-xs font-medium mb-2 ${c.text}`}>{diff}</p>}
          {target && (
            <div className="w-full h-1.5 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden mb-1">
              <div className={`h-full rounded-full ${c.bg} transition-all`} style={{ width: `${pct}%` }} />
            </div>
          )}
          {targetDisplay && (
            <p className="text-[11px] text-gray-400 dark:text-slate-500">
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
  const hasOverdue = installments.some(i => !i.paid && new Date(i.due_date) < new Date())

  if (planClients.length === 0) return null

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-gray-900 dark:text-slate-100">Payment plan tracker</h2>
        {hasOverdue && (
          <span className="text-xs font-semibold text-red-600 bg-red-50 px-2 py-1 rounded-full">Overdue payments</span>
        )}
      </div>

      <div className="space-y-4">
        {planClients.map(client => {
          const clientInsts = installments
            .filter(i => i.client_id === client.id)
            .sort((a, b) => a.month_number - b.month_number)
          const collected = clientInsts.filter(i => i.paid).reduce((sum, i) => sum + i.amount, 0)

          return (
            <div key={client.id} className="flex items-center gap-4">
              <div className="w-32 flex-shrink-0">
                <p className="text-sm font-medium text-gray-900 dark:text-slate-100 truncate">{client.full_name || client.ig_username}</p>
                <p className="text-xs text-gray-400 dark:text-slate-500">{formatCurrency(collected, baseCurrency)} collected</p>
              </div>
              <div className="flex gap-1.5 flex-wrap flex-1">
                {clientInsts.map(inst => {
                  const color = inst.paid ? 'bg-green-400' : new Date(inst.due_date) < new Date() ? 'bg-red-400' : 'bg-gray-200 dark:bg-slate-600'
                  return (
                    <span key={inst.id} title={`Month ${inst.month_number}`} className={`w-4 h-4 rounded-full ${color}`} />
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      <div className="flex items-center gap-4 mt-4 pt-4 border-t border-gray-50 dark:border-slate-700">
        <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-green-400" /><span className="text-xs text-gray-500 dark:text-slate-400">Paid</span></div>
        <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-red-400" /><span className="text-xs text-gray-500 dark:text-slate-400">Missed</span></div>
        <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-gray-200 dark:bg-slate-600" /><span className="text-xs text-gray-500 dark:text-slate-400">Upcoming</span></div>
      </div>
    </div>
  )
}

// ─── History table ────────────────────────────────────────────────────────────

function HistoryTable({ history, currentMonth, baseCurrency }: { history: MonthlySnapshot[]; currentMonth: string; baseCurrency: string }) {
  function pill(value: number, good: number, bad: number) {
    const cls = value >= good ? 'bg-green-100 text-green-700' : value >= bad ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
    return <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cls}`}>{value.toFixed(1)}%</span>
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 p-5">
      <h2 className="font-semibold text-gray-900 dark:text-slate-100 mb-4">Monthly history</h2>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[700px] text-sm">
          <thead>
            <tr className="text-xs text-gray-400 dark:text-slate-500 border-b border-gray-50 dark:border-slate-700 text-left">
              <th className="pb-2 font-medium">Month</th>
              <th className="pb-2 font-medium text-right">Cash in</th>
              <th className="pb-2 font-medium text-right">Contracted</th>
              <th className="pb-2 font-medium text-right">Followers</th>
              <th className="pb-2 font-medium text-right">Meetings</th>
              <th className="pb-2 font-medium">Show-up</th>
              <th className="pb-2 font-medium">Close rate</th>
              <th className="pb-2 font-medium text-right">Signed</th>
            </tr>
          </thead>
          <tbody>
            {history.map(s => (
              <tr
                key={s.month}
                className={`border-b border-gray-50 dark:border-slate-700 ${s.month === currentMonth ? 'bg-blue-50 dark:bg-blue-900/20' : 'hover:bg-gray-50 dark:hover:bg-slate-700'}`}
              >
                <td className="py-2.5 font-medium text-gray-900 dark:text-slate-100">
                  {formatMonth(s.month)}
                  {s.month === currentMonth && <span className="ml-1 text-[10px] text-blue-600 font-bold">NOW</span>}
                </td>
                <td className="py-2.5 text-right">{formatCurrency(s.cash_collected, baseCurrency)}</td>
                <td className="py-2.5 text-right">{formatCurrency(s.revenue_contracted, baseCurrency)}</td>
                <td className="py-2.5 text-right">{s.new_followers}</td>
                <td className="py-2.5 text-right">{s.meetings_booked}</td>
                <td className="py-2.5">{pill(s.show_up_rate, 70, 50)}</td>
                <td className="py-2.5">{pill(s.close_rate, 30, 15)}</td>
                <td className="py-2.5 text-right font-medium">{s.clients_signed}</td>
              </tr>
            ))}
            {history.length === 0 && (
              <tr><td colSpan={8} className="py-8 text-center text-sm text-gray-400 dark:text-slate-500">No history yet. Data will appear at the end of each month.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function NumbersClient({ baseCurrency, targets, currentSnapshot, lastMonthSnapshot, history, clients, installments, currentMonth, expenses, adSpendTotal, totalActiveClients, totalContracted, totalCashCollected, totalOutstanding }: Props) {
  const [compareMode, setCompareMode] = useState<CompareMode>('targets')
  const [lastMonthLocked, setLastMonthLocked] = useState<boolean>(() => {
    if (lastMonthSnapshot !== null) return false
    if (typeof window !== 'undefined' && localStorage.getItem('drivn_lastmonth_unlocked') === '1') return false
    return true
  })
  const [showUnlockModal, setShowUnlockModal] = useState(false)

  const snap = currentSnapshot
  const last = lastMonthSnapshot

  function getCompare<K extends keyof MonthlySnapshot>(key: K): number | null {
    if (compareMode === 'targets') return null
    return last ? (last[key] as number) : null
  }

  function getTarget<K extends keyof KpiTargets>(key: K): number | null {
    if (compareMode === 'last_month') return null
    return targets ? (targets[key] as number) : null
  }

  const outstanding = clients
    .filter(c => c.payment_type === 'plan')
    .reduce((sum, c) => {
      const clientInsts = installments.filter(i => i.client_id === c.id && !i.paid)
      return sum + clientInsts.reduce((s, i) => s + i.amount, 0)
    }, 0)

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-slate-700 bg-white dark:bg-slate-800">
        <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100">Numbers — {formatMonth(currentMonth)}</h1>
        <div className="flex items-center gap-2">
          <div className="flex bg-gray-100 dark:bg-slate-700 rounded-lg p-0.5">
            <button
              onClick={() => setCompareMode('targets')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${compareMode === 'targets' ? 'bg-white dark:bg-slate-600 text-gray-900 dark:text-slate-100 shadow-sm' : 'text-gray-500 dark:text-slate-400'}`}
            >
              vs my targets
            </button>
            {lastMonthLocked ? (
              <div className="relative group">
                <button
                  onClick={() => setShowUnlockModal(true)}
                  className="px-3 py-1.5 rounded-md text-xs font-medium transition-all text-gray-400 dark:text-slate-500 opacity-50 cursor-not-allowed flex items-center gap-0.5"
                  type="button"
                >
                  vs last month
                  <LockIcon />
                </button>
                <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 rounded-lg bg-gray-900 text-white text-xs px-3 py-2 text-center opacity-0 group-hover:opacity-100 transition-opacity z-50 shadow-lg">
                  Available after your first full month — or confirm your previous data to unlock now
                  <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
                </div>
              </div>
            ) : (
              <button
                onClick={() => setCompareMode('last_month')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${compareMode === 'last_month' ? 'bg-white dark:bg-slate-600 text-gray-900 dark:text-slate-100 shadow-sm' : 'text-gray-500 dark:text-slate-400'}`}
              >
                vs last month
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Unlock modal */}
      {showUnlockModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h2 className="text-lg font-bold text-gray-900 dark:text-slate-100 mb-2">
              Unlock month-on-month comparison
            </h2>
            <p className="text-sm text-gray-500 dark:text-slate-400 mb-6">
              Have you already tracked your numbers from last month manually? If so, tap Confirm and we&apos;ll let you compare.
            </p>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => {
                  localStorage.setItem('drivn_lastmonth_unlocked', '1')
                  setLastMonthLocked(false)
                  setShowUnlockModal(false)
                }}
                className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors"
              >
                Confirm — I have last month&apos;s data
              </button>
              <button
                onClick={() => setShowUnlockModal(false)}
                className="w-full py-2.5 rounded-xl bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 text-gray-700 dark:text-slate-300 text-sm font-medium transition-colors"
              >
                Not yet
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-6 space-y-8 max-w-5xl">
        {/* No last month data banner */}
        {compareMode === 'last_month' && last === null && (
          <div className="flex items-start gap-3 rounded-xl border border-blue-100 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/40 px-4 py-3 text-sm text-blue-700 dark:text-blue-300">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 mt-0.5 flex-shrink-0">
              <path fillRule="evenodd" d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-7-4a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM9 9a.75.75 0 0 0 0 1.5h.253a.25.25 0 0 1 .244.304l-.459 2.066A1.75 1.75 0 0 0 10.747 15H11a.75.75 0 0 0 0-1.5h-.253a.25.25 0 0 1-.244-.304l.459-2.066A1.75 1.75 0 0 0 9.253 9H9Z" clipRule="evenodd" />
            </svg>
            No last month data yet. Numbers will appear once you have a full month recorded.
          </div>
        )}

        {/* ── Current business overview (all-time active clients) ── */}
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Current business</p>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: 'Active clients', value: String(totalActiveClients) },
              { label: 'Total contracted', value: formatCurrency(totalContracted, baseCurrency) },
              { label: 'Cash collected', value: formatCurrency(totalCashCollected, baseCurrency) },
              { label: 'Outstanding', value: formatCurrency(totalOutstanding, baseCurrency) },
            ].map(({ label, value }) => (
              <div key={label} className="bg-white rounded-xl border border-gray-100 px-4 py-3">
                <p className="text-xs text-gray-500 font-medium mb-1">{label}</p>
                <p className="text-xl font-bold text-gray-900">{value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Monthly KPIs ── */}
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">This month — {formatMonth(currentMonth)}</p>

        {/* KPI cards — row 1 */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
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
            label="Outstanding"
            value={outstanding}
            displayValue={formatCurrency(outstanding, baseCurrency)}
            compareMode={compareMode}
            color="neutral"
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

        {/* KPI cards — row 2 (supporting) */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
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
        </div>{/* end monthly section */}

        {/* Chart */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 p-5">
          <h2 className="font-semibold text-gray-900 dark:text-slate-100 mb-4">Performance over time</h2>
          <RevenueChart history={history} baseCurrency={baseCurrency} />
        </div>

        {/* History table */}
        <HistoryTable history={history} currentMonth={currentMonth} baseCurrency={baseCurrency} />

        {/* Payment tracker */}
        <PaymentTracker clients={clients} installments={installments} baseCurrency={baseCurrency} />

        {/* Expenses & profit */}
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
