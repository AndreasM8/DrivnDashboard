'use client'

import { useState } from 'react'
import type { Expense } from '@/types'
import { useT } from '@/contexts/LanguageContext'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  expenses: Expense[]
  adSpendTotal: number
  currency: string
  currentMonth: string
  cashCollected: number
}

type ExpenseCategory = 'team' | 'software' | 'ads' | 'withdrawal' | 'other' | 'salary' | 'subscriptions' | 'investments'
type TeamRole = 'setter' | 'closer' | 'editor' | 'growth_partner'
type PaymentStructure = 'monthly' | 'retainer' | 'both'

const CATEGORY_META: Record<ExpenseCategory, { label: string }> = {
  team:          { label: 'Team' },
  salary:        { label: 'Salary' },
  software:      { label: 'Software' },
  subscriptions: { label: 'Subscriptions' },
  ads:           { label: 'Ads' },
  investments:   { label: 'Investments' },
  withdrawal:    { label: 'Withdrawals' },
  other:         { label: 'Other' },
}

const CATEGORY_ORDER: ExpenseCategory[] = ['team', 'salary', 'software', 'subscriptions', 'ads', 'investments', 'withdrawal', 'other']

const TEAM_ROLES: { value: TeamRole; label: string }[] = [
  { value: 'setter', label: 'Setter' },
  { value: 'closer', label: 'Closer' },
  { value: 'editor', label: 'Editor' },
  { value: 'growth_partner', label: 'Growth Partner' },
]

const PAYMENT_STRUCTURES: { value: PaymentStructure; label: string }[] = [
  { value: 'monthly', label: 'Monthly amount' },
  { value: 'retainer', label: 'Retainer' },
  { value: 'both', label: 'Both' },
]

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
  cashCollected,
}: Props) {
  const t = useT()
  const [expenses, setExpenses] = useState<Expense[]>(initialExpenses)
  const [showAddForm, setShowAddForm] = useState(false)
  const [formCategory, setFormCategory] = useState<ExpenseCategory>('team')
  const [formLabel, setFormLabel] = useState('')
  const [formAmount, setFormAmount] = useState('')
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [formTeamRole, setFormTeamRole] = useState<TeamRole>('setter')
  const [formPaymentStructure, setFormPaymentStructure] = useState<PaymentStructure>('monthly')

  // ── Derived totals ───────────────────────────────────────────────────────

  const totalByCategory: Record<ExpenseCategory, number> = {
    team:          0,
    salary:        0,
    software:      0,
    subscriptions: 0,
    ads:           adSpendTotal,
    investments:   0,
    withdrawal:    0,
    other:         0,
  }

  for (const exp of expenses) {
    totalByCategory[exp.category] += exp.amount
  }

  const totalExpenses =
    totalByCategory.team +
    totalByCategory.salary +
    totalByCategory.software +
    totalByCategory.subscriptions +
    totalByCategory.ads +
    totalByCategory.investments +
    totalByCategory.withdrawal +
    totalByCategory.other

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
          team_role: formCategory === 'team' ? formTeamRole : null,
          payment_structure: formCategory === 'team' ? formPaymentStructure : null,
        }),
      })

      if (res.ok) {
        const json = await res.json() as { expense: Expense }
        setExpenses(prev => [...prev, json.expense])
        setFormLabel('')
        setFormAmount('')
        setFormCategory('team')
        setFormTeamRole('setter')
        setFormPaymentStructure('monthly')
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
    <div style={{ background: 'var(--surface-1)', borderRadius: 'var(--radius-card)', border: '1px solid var(--border)', padding: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2 style={{ fontWeight: 600, color: 'var(--text-1)', margin: 0, fontSize: 15 }}>{t.numbers.expenses} &amp; {t.numbers.profit}</h2>
        <button
          onClick={() => setShowAddForm(v => !v)}
          style={{ fontSize: 12, fontWeight: 500, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px', borderRadius: 'var(--radius-btn)', transition: 'background 120ms' }}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(37,99,235,0.08)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'none')}
        >
          {showAddForm ? t.common.cancel : `+ ${t.numbers.addExpense}`}
        </button>
      </div>

      {/* Inline add form */}
      {showAddForm && (
        <div style={{ marginBottom: 16, padding: 16, borderRadius: 'var(--radius-card)', background: 'var(--surface-2)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-caps" style={{ display: 'block', marginBottom: 4 }}>Category</label>
              <select
                value={formCategory}
                onChange={e => setFormCategory(e.target.value as ExpenseCategory)}
                className="input-base"
              >
                {CATEGORY_ORDER.map(cat => (
                  <option key={cat} value={cat}>
                    {CATEGORY_META[cat].label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label-caps" style={{ display: 'block', marginBottom: 4 }}>Amount ({currency})</label>
              <input
                type="number"
                value={formAmount}
                onChange={e => setFormAmount(e.target.value)}
                placeholder="0"
                min="0"
                step="1"
                className="input-base"
              />
            </div>
          </div>

          {formCategory === 'team' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label-caps" style={{ display: 'block', marginBottom: 4 }}>Team member</label>
                <select
                  value={formTeamRole}
                  onChange={e => {
                    setFormTeamRole(e.target.value as TeamRole)
                    // Auto-suggest label
                    const roleLabel = TEAM_ROLES.find(r => r.value === e.target.value)?.label ?? ''
                    if (!formLabel || TEAM_ROLES.some(r => formLabel.startsWith(r.label))) {
                      setFormLabel(roleLabel)
                    }
                  }}
                  className="input-base"
                >
                  {TEAM_ROLES.map(r => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label-caps" style={{ display: 'block', marginBottom: 4 }}>Payment type</label>
                <select
                  value={formPaymentStructure}
                  onChange={e => setFormPaymentStructure(e.target.value as PaymentStructure)}
                  className="input-base"
                >
                  {PAYMENT_STRUCTURES.map(p => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          <div>
            <label className="label-caps" style={{ display: 'block', marginBottom: 4 }}>Label</label>
            <input
              type="text"
              value={formLabel}
              onChange={e => setFormLabel(e.target.value)}
              placeholder="What's it for? e.g. 'Setter salary'"
              className="input-base"
            />
          </div>
          <div className="flex items-center gap-2" style={{ paddingTop: 4 }}>
            <button
              onClick={handleSave}
              disabled={saving || !formLabel.trim() || !formAmount}
              className="btn-primary"
              style={{ padding: '8px 16px' }}
            >
              {saving ? t.common.saving : t.common.save}
            </button>
            <button
              onClick={() => {
                setShowAddForm(false)
                setFormLabel('')
                setFormAmount('')
                setFormCategory('team')
                setFormTeamRole('setter')
                setFormPaymentStructure('monthly')
              }}
              className="btn-ghost"
              style={{ padding: '8px 16px' }}
            >
              {t.common.cancel}
            </button>
          </div>
        </div>
      )}

      {/* Expense rows by category */}
      {visibleCategories.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
          {visibleCategories.map(cat => {
            const meta = CATEGORY_META[cat]
            const catTotal = totalByCategory[cat]
            const catExpenses = expenses.filter(e => e.category === cat)
            const isAds = cat === 'ads'

            return (
              <div key={cat}>
                {/* Category total row */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 14 }}>
                  <span style={{ fontWeight: 500, color: 'var(--text-1)' }}>{t.expenseCategories[cat as keyof typeof t.expenseCategories] ?? meta.label}</span>
                  <span style={{ fontWeight: 600, color: 'var(--text-1)' }}>{formatCurrency(catTotal, currency)}</span>
                </div>

                {/* Ad spend note */}
                {isAds && adSpendTotal > 0 && (
                  <div style={{ marginLeft: 24, marginTop: 4 }}>
                    <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
                      {formatCurrency(adSpendTotal, currency)} from ad spend log
                    </span>
                  </div>
                )}

                {/* Individual expense items */}
                {catExpenses.length > 0 && (
                  <ul style={{ marginTop: 4, listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {catExpenses.map(exp => (
                      <li key={exp.id} style={{ marginLeft: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 12, color: 'var(--text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, marginRight: 8 }}>
                          {exp.label}
                        </span>
                        <span style={{ fontSize: 12, color: 'var(--text-2)', marginRight: 8, flexShrink: 0 }}>
                          {formatCurrency(exp.amount, currency)}
                        </span>
                        <button
                          onClick={() => handleDelete(exp.id)}
                          disabled={deletingId === exp.id}
                          style={{ color: 'var(--border-strong)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, lineHeight: 1, flexShrink: 0, padding: 0, opacity: deletingId === exp.id ? 0.4 : 1, transition: 'color 120ms' }}
                          onMouseEnter={e => (e.currentTarget.style.color = 'var(--danger)')}
                          onMouseLeave={e => (e.currentTarget.style.color = 'var(--border-strong)')}
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
        <p style={{ fontSize: 14, color: 'var(--text-3)', marginBottom: 16 }}>
          {t.numbers.noExpenses}
        </p>
      )}

      {/* P&L summary */}
      {(totalExpenses > 0 || cashCollected > 0) && (
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12, marginTop: 4, display: 'flex', flexDirection: 'column', gap: 8 }}>

          {/* Revenue row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 14 }}>
            <span style={{ color: 'var(--text-2)' }}>{t.numbers.cashCollected}</span>
            <span style={{ fontWeight: 500, color: 'var(--text-1)' }}>
              {formatCurrency(cashCollected, currency)}
            </span>
          </div>

          {/* Total expenses row */}
          {totalExpenses > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 14 }}>
              <span style={{ color: 'var(--text-2)' }}>{t.numbers.expenses}</span>
              <span style={{ fontWeight: 500, color: 'var(--danger)' }}>
                − {formatCurrency(totalExpenses, currency)}
              </span>
            </div>
          )}

          {/* Net profit */}
          {totalExpenses > 0 && (() => {
            const net    = cashCollected - totalExpenses
            const margin = cashCollected > 0 ? Math.round((net / cashCollected) * 100) : 0
            const positive = net >= 0
            return (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderRadius: 'var(--radius-card)', padding: '10px 12px', marginTop: 4, background: positive ? 'rgba(22,163,74,0.08)' : 'rgba(220,38,38,0.06)' }}>
                <div>
                  <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: positive ? 'var(--success)' : 'var(--danger)', margin: 0 }}>
                    {t.numbers.netProfit}
                  </p>
                  <p style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 2 }}>
                    {positive ? `${margin}% ${t.numbers.profitMargin.toLowerCase()}` : 'Operating at a loss'}
                  </p>
                </div>
                <p style={{ fontSize: 18, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: positive ? 'var(--success)' : 'var(--danger)', margin: 0 }}>
                  {positive ? '' : '−'}{formatCurrency(Math.abs(net), currency)}
                </p>
              </div>
            )
          })()}
        </div>
      )}
    </div>
  )
}
