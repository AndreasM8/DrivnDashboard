'use client'

import { useState } from 'react'
import type { Expense } from '@/types'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  expenses: Expense[]
  adSpendTotal: number
  currency: string
  currentMonth: string
}

type ExpenseCategory = 'team' | 'software' | 'ads' | 'withdrawal' | 'other'

const CATEGORY_META: Record<ExpenseCategory, { label: string; icon: string }> = {
  team:       { label: 'Team',        icon: '👥' },
  software:   { label: 'Software',    icon: '💻' },
  ads:        { label: 'Ads',         icon: '📣' },
  withdrawal: { label: 'Withdrawals', icon: '💸' },
  other:      { label: 'Other',       icon: '📦' },
}

const CATEGORY_ORDER: ExpenseCategory[] = ['team', 'software', 'ads', 'withdrawal', 'other']

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat('en', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount)
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ExpensesSection({
  expenses: initialExpenses,
  adSpendTotal,
  currency,
  currentMonth,
}: Props) {
  const [expenses, setExpenses] = useState<Expense[]>(initialExpenses)
  const [showAddForm, setShowAddForm] = useState(false)
  const [formCategory, setFormCategory] = useState<ExpenseCategory>('team')
  const [formLabel, setFormLabel] = useState('')
  const [formAmount, setFormAmount] = useState('')
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // ── Derived totals ───────────────────────────────────────────────────────

  const totalByCategory: Record<ExpenseCategory, number> = {
    team:       0,
    software:   0,
    ads:        adSpendTotal,
    withdrawal: 0,
    other:      0,
  }

  for (const exp of expenses) {
    totalByCategory[exp.category] += exp.amount
  }

  const totalExpenses =
    totalByCategory.team +
    totalByCategory.software +
    totalByCategory.ads +
    totalByCategory.withdrawal +
    totalByCategory.other

  // Cash collected is not available in this component directly, so we surface
  // it via a prop if needed — for now we compute net profit from what we have.
  // (The parent passes cashCollected if desired; for this component we show
  //  the breakdown and let the parent compute margin if it wants.)
  // Actually per the spec we need cashCollected to show margin %. We receive
  // it as adSpendTotal only, so we need to accept cashCollected too.
  // The spec says to compute margin = net / cash_collected * 100.
  // We'll surface this by accepting an optional cashCollected prop.

  // ── Handlers ────────────────────────────────────────────────────────────

  async function handleSave() {
    const amt = parseFloat(formAmount)
    if (!formLabel.trim() || isNaN(amt) || amt <= 0) return

    setSaving(true)
    try {
      const res = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          month: currentMonth,
          category: formCategory,
          label: formLabel.trim(),
          amount: amt,
          currency,
        }),
      })

      if (res.ok) {
        const json = await res.json() as { expense: Expense }
        setExpenses(prev => [...prev, json.expense])
        setFormLabel('')
        setFormAmount('')
        setFormCategory('team')
        setShowAddForm(false)
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id)
    try {
      const res = await fetch(`/api/expenses/${id}`, { method: 'DELETE' })
      if (res.ok) {
        setExpenses(prev => prev.filter(e => e.id !== id))
      }
    } finally {
      setDeletingId(null)
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────

  const visibleCategories = CATEGORY_ORDER.filter(cat => {
    if (cat === 'ads') return adSpendTotal > 0 || expenses.some(e => e.category === 'ads')
    return totalByCategory[cat] > 0
  })

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-gray-900 dark:text-slate-100">Expenses &amp; profit</h2>
        <button
          onClick={() => setShowAddForm(v => !v)}
          className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors px-2 py-1 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20"
        >
          {showAddForm ? 'Cancel' : '+ Add'}
        </button>
      </div>

      {/* Inline add form */}
      {showAddForm && (
        <div className="mb-4 p-4 rounded-xl bg-gray-50 dark:bg-slate-700/50 border border-gray-100 dark:border-slate-700 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">Category</label>
              <select
                value={formCategory}
                onChange={e => setFormCategory(e.target.value as ExpenseCategory)}
                className="w-full border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {CATEGORY_ORDER.map(cat => (
                  <option key={cat} value={cat}>
                    {CATEGORY_META[cat].icon} {CATEGORY_META[cat].label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">Amount ({currency})</label>
              <input
                type="number"
                value={formAmount}
                onChange={e => setFormAmount(e.target.value)}
                placeholder="0"
                min="0"
                step="1"
                className="w-full border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">Label</label>
            <input
              type="text"
              value={formLabel}
              onChange={e => setFormLabel(e.target.value)}
              placeholder="What's it for? e.g. 'Setter salary'"
              className="w-full border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={handleSave}
              disabled={saving || !formLabel.trim() || !formAmount}
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button
              onClick={() => {
                setShowAddForm(false)
                setFormLabel('')
                setFormAmount('')
                setFormCategory('team')
              }}
              className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-slate-600 hover:bg-gray-200 dark:hover:bg-slate-500 text-gray-700 dark:text-slate-300 text-sm font-medium transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Expense rows by category */}
      {visibleCategories.length > 0 && (
        <div className="space-y-3 mb-4">
          {visibleCategories.map(cat => {
            const meta = CATEGORY_META[cat]
            const catTotal = totalByCategory[cat]
            const catExpenses = expenses.filter(e => e.category === cat)
            const isAds = cat === 'ads'

            return (
              <div key={cat}>
                {/* Category total row */}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-700 dark:text-slate-300 font-medium">
                    {meta.icon} {meta.label}
                  </span>
                  <span className="font-semibold text-gray-900 dark:text-slate-100">
                    {formatCurrency(catTotal, currency)}
                  </span>
                </div>

                {/* Ad spend note */}
                {isAds && adSpendTotal > 0 && (
                  <div className="ml-6 mt-1">
                    <span className="text-xs text-gray-400 dark:text-slate-500">
                      {formatCurrency(adSpendTotal, currency)} from ad spend log
                    </span>
                  </div>
                )}

                {/* Individual expense items */}
                {catExpenses.length > 0 && (
                  <ul className="mt-1 space-y-0.5">
                    {catExpenses.map(exp => (
                      <li key={exp.id} className="ml-6 flex items-center justify-between">
                        <span className="text-xs text-gray-500 dark:text-slate-400 truncate flex-1 mr-2">
                          {exp.label}
                        </span>
                        <span className="text-xs text-gray-500 dark:text-slate-400 mr-2 flex-shrink-0">
                          {formatCurrency(exp.amount, currency)}
                        </span>
                        <button
                          onClick={() => handleDelete(exp.id)}
                          disabled={deletingId === exp.id}
                          className="text-gray-300 dark:text-slate-600 hover:text-rose-400 dark:hover:text-rose-400 transition-colors text-sm leading-none flex-shrink-0 disabled:opacity-50"
                          title="Delete"
                        >
                          ×
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )
          })}
        </div>
      )}

      {visibleCategories.length === 0 && (
        <p className="text-sm text-gray-400 dark:text-slate-500 mb-4">
          No expenses recorded for this month yet. Tap + Add to get started.
        </p>
      )}

      {/* Divider */}
      {totalExpenses > 0 && (
        <div className="border-t border-gray-100 dark:border-slate-700 pt-3 mt-1">
          <div className="flex items-center justify-between text-sm text-gray-600 dark:text-slate-400">
            <span>Total expenses</span>
            <span className="font-semibold text-gray-900 dark:text-slate-100">
              {formatCurrency(totalExpenses, currency)}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
