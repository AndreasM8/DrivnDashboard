'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { triggerSheetsSync } from '@/lib/sync-sheets-client'
import type { Client, PaymentType } from '@/types'

interface Props {
  userId: string
  baseCurrency: string
  onClose: () => void
  onAdded: (client: Client) => void
}

const PLAN_MONTHS = [1, 2, 3, 4, 6, 9, 12]

export default function AddClientModal({ userId, baseCurrency, onClose, onAdded }: Props) {
  const [igUsername, setIgUsername] = useState('')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [programType, setProgramType] = useState('')
  const [referredBy, setReferredBy] = useState('')
  const [paymentType, setPaymentType] = useState<PaymentType>('pif')
  const [totalAmount, setTotalAmount] = useState('')
  const [monthlyAmount, setMonthlyAmount] = useState('')
  const [planMonths, setPlanMonths] = useState(3)
  const [splitPayments, setSplitPayments] = useState(2)
  const [splitAmount, setSplitAmount] = useState('')
  const [startedAt, setStartedAt] = useState(new Date().toISOString().slice(0, 10))
  const [showMore, setShowMore] = useState(false)
  const [loading, setLoading] = useState(false)

  const isBackdated = startedAt < new Date().toISOString().slice(0, 10)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    const supabase = createClient()
    const total = paymentType === 'plan'
      ? Number(monthlyAmount) * planMonths
      : paymentType === 'split'
        ? Number(splitAmount) * splitPayments
        : Number(totalAmount)

    const { data } = await supabase.from('clients').insert({
      user_id: userId,
      ig_username: igUsername.replace('@', ''),
      full_name: fullName,
      email,
      phone,
      program_type: programType,
      referred_by: referredBy,
      payment_type: paymentType,
      plan_months: planMonths,
      monthly_amount: paymentType === 'plan' ? Number(monthlyAmount) : paymentType === 'split' ? Number(splitAmount) : null,
      total_amount: total,
      currency: baseCurrency,
      started_at: new Date(startedAt).toISOString(),
    }).select().single()

    if (data) {
      const start = new Date(startedAt)
      if (paymentType === 'plan') {
        const installments = Array.from({ length: planMonths }, (_, i) => {
          const due = new Date(start)
          due.setMonth(due.getMonth() + i)
          return {
            client_id: data.id,
            month_number: i + 1,
            due_date: due.toISOString().slice(0, 10),
            amount: Number(monthlyAmount),
          }
        })
        await supabase.from('payment_installments').insert(installments)
      }
      if (paymentType === 'split') {
        const installments = Array.from({ length: splitPayments }, (_, i) => {
          const due = new Date(start)
          due.setMonth(due.getMonth() + i)
          return {
            client_id: data.id,
            month_number: i + 1,
            due_date: due.toISOString().slice(0, 10),
            amount: Number(splitAmount),
          }
        })
        await supabase.from('payment_installments').insert(installments)
      }
      onAdded(data as Client)
      triggerSheetsSync()
    }
    setLoading(false)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: 'rgba(0,0,0,0.4)' }}>
      <div className="modal-enter" style={{ background: 'var(--surface-1)', borderRadius: 'var(--radius-panel)', boxShadow: 'var(--shadow-dropdown)', width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ position: 'sticky', top: 0, background: 'var(--surface-1)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderBottom: '1px solid var(--border)', zIndex: 1 }}>
          <h2 className="section-title" style={{ margin: 0 }}>Add client</h2>
          <button
            onClick={onClose}
            style={{ color: 'var(--text-3)', background: 'none', border: 'none', cursor: 'pointer', padding: 4, lineHeight: 0, transition: 'color 120ms ease' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-1)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-3)')}
          >
            <svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Core info */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-caps" style={{ display: 'block', marginBottom: 4 }}>Instagram handle</label>
              <input
                value={igUsername}
                onChange={e => setIgUsername(e.target.value)}
                placeholder="@username"
                className="input-base"
              />
            </div>
            <div>
              <label className="label-caps" style={{ display: 'block', marginBottom: 4 }}>Full name</label>
              <input
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                placeholder="Jane Smith"
                className="input-base"
              />
            </div>
          </div>

          <div>
            <label className="label-caps" style={{ display: 'block', marginBottom: 4 }}>Program / offer</label>
            <input
              value={programType}
              onChange={e => setProgramType(e.target.value)}
              placeholder="e.g. 12-week transformation, 1:1 coaching…"
              className="input-base"
            />
          </div>

          {/* Start date */}
          <div>
            <label className="label-caps" style={{ display: 'block', marginBottom: 4 }}>Start date</label>
            <input
              type="date"
              value={startedAt}
              onChange={e => setStartedAt(e.target.value)}
              className="input-base"
            />
            {isBackdated && (
              <p style={{ fontSize: 12, color: 'var(--warning)', marginTop: 4 }}>
                Backdated client — payment installments will be created from this date. Tap the dots in the client drawer to mark which ones have already been paid.
              </p>
            )}
          </div>

          {/* Payment type */}
          <div>
            <label className="label-caps" style={{ display: 'block', marginBottom: 8 }}>Payment type</label>
            <div className="flex gap-2">
              {(['pif', 'split', 'plan'] as PaymentType[]).map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setPaymentType(t)}
                  style={{
                    flex: 1, padding: '8px 0', borderRadius: 'var(--radius-btn)', fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 150ms',
                    background: paymentType === t ? 'rgba(37,99,235,0.1)' : 'transparent',
                    color: paymentType === t ? 'var(--accent)' : 'var(--text-2)',
                    border: `1px solid ${paymentType === t ? 'var(--accent)' : 'var(--border)'}`,
                  }}
                >
                  {t === 'pif' ? 'Paid in full' : t === 'split' ? 'Split pay' : 'Payment plan'}
                </button>
              ))}
            </div>
          </div>

          {/* PIF: total + duration */}
          {paymentType === 'pif' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label className="label-caps" style={{ display: 'block', marginBottom: 4 }}>Total amount ({baseCurrency})</label>
                <input
                  type="number"
                  value={totalAmount}
                  onChange={e => setTotalAmount(e.target.value)}
                  placeholder="0"
                  className="input-base"
                />
              </div>
              <div>
                <label className="label-caps" style={{ display: 'block', marginBottom: 8 }}>Duration (months)</label>
                <div className="flex gap-1.5 flex-wrap">
                  {PLAN_MONTHS.map(m => (
                    <button key={m} type="button" onClick={() => setPlanMonths(m)}
                      style={{ width: 40, height: 40, borderRadius: 'var(--radius-btn)', fontSize: 14, fontWeight: 600, border: 'none', cursor: 'pointer', transition: 'all 150ms', background: planMonths === m ? 'var(--accent)' : 'var(--surface-3)', color: planMonths === m ? '#fff' : 'var(--text-2)' }}>
                      {m}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Split: N payments + amount per payment + duration */}
          {paymentType === 'split' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label className="label-caps" style={{ display: 'block', marginBottom: 8 }}>Number of payments</label>
                <div className="flex gap-2">
                  {[2, 3, 4, 5, 6].map(n => (
                    <button key={n} type="button" onClick={() => setSplitPayments(n)}
                      style={{ width: 40, height: 40, borderRadius: 'var(--radius-btn)', fontSize: 14, fontWeight: 600, border: 'none', cursor: 'pointer', transition: 'all 150ms', background: splitPayments === n ? 'var(--accent)' : 'var(--surface-3)', color: splitPayments === n ? '#fff' : 'var(--text-2)' }}>
                      {n}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="label-caps" style={{ display: 'block', marginBottom: 4 }}>Amount per payment ({baseCurrency})</label>
                <input
                  type="number"
                  value={splitAmount}
                  onChange={e => setSplitAmount(e.target.value)}
                  placeholder="0"
                  className="input-base"
                />
              </div>
              <div>
                <label className="label-caps" style={{ display: 'block', marginBottom: 8 }}>Duration (months)</label>
                <div className="flex gap-1.5 flex-wrap">
                  {PLAN_MONTHS.map(m => (
                    <button key={m} type="button" onClick={() => setPlanMonths(m)}
                      style={{ width: 40, height: 40, borderRadius: 'var(--radius-btn)', fontSize: 14, fontWeight: 600, border: 'none', cursor: 'pointer', transition: 'all 150ms', background: planMonths === m ? 'var(--accent)' : 'var(--surface-3)', color: planMonths === m ? '#fff' : 'var(--text-2)' }}>
                      {m}
                    </button>
                  ))}
                </div>
              </div>
              {splitAmount && (
                <div style={{ background: 'rgba(37,99,235,0.08)', borderRadius: 'var(--radius-btn)', padding: '8px 12px', display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                  <span style={{ color: 'var(--text-2)' }}>Total contract value</span>
                  <span style={{ fontWeight: 600, color: 'var(--text-1)' }}>{Number(splitAmount) * splitPayments} {baseCurrency}</span>
                </div>
              )}
            </div>
          )}

          {/* Payment plan: monthly + duration */}
          {paymentType === 'plan' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label className="label-caps" style={{ display: 'block', marginBottom: 4 }}>Monthly amount ({baseCurrency})</label>
                <input
                  type="number"
                  value={monthlyAmount}
                  onChange={e => setMonthlyAmount(e.target.value)}
                  placeholder="0"
                  className="input-base"
                />
              </div>
              <div>
                <label className="label-caps" style={{ display: 'block', marginBottom: 8 }}>Contract length</label>
                <div className="flex gap-1.5 flex-wrap">
                  {PLAN_MONTHS.map(m => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setPlanMonths(m)}
                      style={{ width: 40, height: 40, borderRadius: 'var(--radius-btn)', fontSize: 14, fontWeight: 600, border: 'none', cursor: 'pointer', transition: 'all 150ms', background: planMonths === m ? 'var(--accent)' : 'var(--surface-3)', color: planMonths === m ? '#fff' : 'var(--text-2)' }}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>
              {monthlyAmount && (
                <div style={{ background: 'rgba(37,99,235,0.08)', borderRadius: 'var(--radius-btn)', padding: '8px 12px', display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                  <span style={{ color: 'var(--text-2)' }}>Total contract value</span>
                  <span style={{ fontWeight: 600, color: 'var(--text-1)' }}>{Number(monthlyAmount) * planMonths} {baseCurrency}</span>
                </div>
              )}
            </div>
          )}

          {/* Optional extra details */}
          <button
            type="button"
            onClick={() => setShowMore(v => !v)}
            style={{ fontSize: 12, fontWeight: 500, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0 }}
          >
            {showMore ? 'Hide extra details' : '+ Add email, phone, referral…'}
          </button>

          {showMore && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label-caps" style={{ display: 'block', marginBottom: 4 }}>Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="jane@email.com"
                    className="input-base"
                  />
                </div>
                <div>
                  <label className="label-caps" style={{ display: 'block', marginBottom: 4 }}>Phone</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder="+1 555 000 000"
                    className="input-base"
                  />
                </div>
              </div>
              <div>
                <label className="label-caps" style={{ display: 'block', marginBottom: 4 }}>Referred by</label>
                <input
                  value={referredBy}
                  onChange={e => setReferredBy(e.target.value)}
                  placeholder="Name or IG handle of who referred them"
                  className="input-base"
                />
              </div>
            </div>
          )}

          <div className="flex gap-3" style={{ paddingTop: 8 }}>
            <button type="button" onClick={onClose} className="btn-ghost" style={{ flex: 1, padding: '10px 0' }}>
              Cancel
            </button>
            <button type="submit" disabled={loading} className="btn-primary" style={{ flex: 1, padding: '10px 0' }}>
              {loading ? 'Adding…' : 'Add client'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
