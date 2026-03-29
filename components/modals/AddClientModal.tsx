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
      plan_months: paymentType === 'plan' ? planMonths : null,
      monthly_amount: paymentType === 'plan' ? Number(monthlyAmount) : null,
      total_amount: total,
      currency: baseCurrency,
      started_at: new Date(startedAt).toISOString(),
    }).select().single()

    if (data) {
      if (paymentType === 'plan') {
        const start = new Date(startedAt)
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
      onAdded(data as Client)
      triggerSheetsSync()
    }
    setLoading(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">Add client</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">

          {/* Core info */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Instagram handle</label>
              <input
                value={igUsername}
                onChange={e => setIgUsername(e.target.value)}
                placeholder="@username"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Full name</label>
              <input
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                placeholder="Jane Smith"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Program / offer</label>
            <input
              value={programType}
              onChange={e => setProgramType(e.target.value)}
              placeholder="e.g. 12-week transformation, 1:1 coaching…"
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Start date */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Start date</label>
            <input
              type="date"
              value={startedAt}
              onChange={e => setStartedAt(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {isBackdated && (
              <p className="text-xs text-amber-600 mt-1">
                Backdated client — payment installments will be created from this date. Tap the dots in the client drawer to mark which ones have already been paid.
              </p>
            )}
          </div>

          {/* Payment type */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-2">Payment type</label>
            <div className="flex gap-2">
              {(['pif', 'split', 'plan'] as PaymentType[]).map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setPaymentType(t)}
                  className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition-all ${
                    paymentType === t ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600'
                  }`}
                >
                  {t === 'pif' ? 'Paid in full' : t === 'split' ? 'Split pay' : 'Payment plan'}
                </button>
              ))}
            </div>
          </div>

          {(paymentType === 'pif' || paymentType === 'split') && (
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Total amount ({baseCurrency})</label>
              <input
                type="number"
                value={totalAmount}
                onChange={e => setTotalAmount(e.target.value)}
                placeholder="0"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          {paymentType === 'plan' && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Monthly amount ({baseCurrency})</label>
                <input
                  type="number"
                  value={monthlyAmount}
                  onChange={e => setMonthlyAmount(e.target.value)}
                  placeholder="0"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-2">Contract length</label>
                <div className="flex gap-1.5 flex-wrap">
                  {PLAN_MONTHS.map(m => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setPlanMonths(m)}
                      className={`w-10 h-10 rounded-lg text-sm font-semibold transition-all ${
                        planMonths === m ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>
              {monthlyAmount && (
                <div className="bg-blue-50 rounded-lg px-3 py-2 flex justify-between text-xs">
                  <span className="text-gray-500">Total contract value</span>
                  <span className="font-semibold text-gray-900">{Number(monthlyAmount) * planMonths} {baseCurrency}</span>
                </div>
              )}
            </div>
          )}

          {/* Optional extra details */}
          <button
            type="button"
            onClick={() => setShowMore(v => !v)}
            className="text-xs text-blue-600 hover:text-blue-700 font-medium"
          >
            {showMore ? '↑ Hide extra details' : '+ Add email, phone, referral…'}
          </button>

          {showMore && (
            <div className="space-y-3 pt-1">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="jane@email.com"
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Phone</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder="+1 555 000 000"
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Referred by</label>
                <input
                  value={referredBy}
                  onChange={e => setReferredBy(e.target.value)}
                  placeholder="Name or IG handle of who referred them"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-xl text-sm font-medium">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium disabled:opacity-50">
              {loading ? 'Adding…' : 'Add client'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
