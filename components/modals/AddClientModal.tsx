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
  const [paymentType, setPaymentType] = useState<PaymentType>('pif')
  const [totalAmount, setTotalAmount] = useState('')
  const [monthlyAmount, setMonthlyAmount] = useState('')
  const [planMonths, setPlanMonths] = useState(3)
  const [loading, setLoading] = useState(false)

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
      payment_type: paymentType,
      plan_months: paymentType === 'plan' ? planMonths : null,
      monthly_amount: paymentType === 'plan' ? Number(monthlyAmount) : null,
      total_amount: total,
      currency: baseCurrency,
      started_at: new Date().toISOString(),
    }).select().single()

    if (data) {
      // Create installments for plan
      if (paymentType === 'plan') {
        const installments = Array.from({ length: planMonths }, (_, i) => {
          const due = new Date()
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
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-gray-900">Add client</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Instagram username</label>
              <input
                value={igUsername}
                onChange={e => setIgUsername(e.target.value)}
                placeholder="@username"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Full name</label>
              <input
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                placeholder="Jane Smith"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Payment type</label>
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Total amount ({baseCurrency})</label>
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Monthly amount ({baseCurrency})</label>
                <input
                  type="number"
                  value={monthlyAmount}
                  onChange={e => setMonthlyAmount(e.target.value)}
                  placeholder="0"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Months</label>
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
                <p className="text-xs text-gray-400">Total: {Number(monthlyAmount) * planMonths} {baseCurrency}</p>
              )}
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-xl text-sm font-medium">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium disabled:opacity-50">
              {loading ? 'Adding…' : 'Add client'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
