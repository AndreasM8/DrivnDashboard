'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import type { Client, PaymentInstallment } from '@/types'

interface Props {
  client: Client
  installments: PaymentInstallment[]
  baseCurrency: string
  onClose: () => void
  onUpdate: (updated: Client) => void
}

function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat('en', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount)
}

function PaymentDot({ installment, onToggle }: { installment: PaymentInstallment; onToggle: () => void }) {
  const isPast = new Date(installment.due_date) < new Date()
  const color = installment.paid
    ? 'bg-green-400 border-green-400'
    : isPast
      ? 'bg-red-400 border-red-400'
      : 'bg-gray-100 border-gray-300'

  return (
    <button
      onClick={onToggle}
      title={`Month ${installment.month_number}: ${installment.paid ? 'Paid ✓' : 'Pending'} — ${new Date(installment.due_date).toLocaleDateString('en', { month: 'short', day: 'numeric' })}`}
      className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs font-bold transition-all hover:scale-110 ${color} ${installment.paid ? 'text-white' : 'text-gray-500'}`}
    >
      {installment.month_number}
    </button>
  )
}

export default function ClientDrawer({ client, installments, baseCurrency, onClose, onUpdate }: Props) {
  const [notes, setNotes] = useState(client.notes)
  const [upsellOn, setUpsellOn] = useState(client.upsell_reminder_set)
  const [upsellMonth, setUpsellMonth] = useState(client.upsell_reminder_month ?? 3)
  const [saving, setSaving] = useState(false)
  const [insts, setInsts] = useState<PaymentInstallment[]>(installments)
  const supabase = createClient()

  const monthsElapsed = Math.floor(
    (Date.now() - new Date(client.started_at).getTime()) / (30 * 24 * 60 * 60 * 1000)
  )

  async function saveNotes() {
    setSaving(true)
    const { data } = await supabase.from('clients').update({ notes }).eq('id', client.id).select().single()
    if (data) onUpdate(data as Client)
    setSaving(false)
  }

  async function toggleUpsell() {
    const newVal = !upsellOn
    setUpsellOn(newVal)
    const { data } = await supabase.from('clients').update({
      upsell_reminder_set: newVal,
      upsell_reminder_month: newVal ? upsellMonth : null,
    }).eq('id', client.id).select().single()
    if (data) onUpdate(data as Client)
  }

  async function togglePayment(instId: string, currentPaid: boolean) {
    const newPaid = !currentPaid
    await supabase.from('payment_installments').update({
      paid: newPaid,
      paid_at: newPaid ? new Date().toISOString() : null,
      manually_confirmed: newPaid,
    }).eq('id', instId)
    setInsts(is => is.map(i => i.id === instId ? { ...i, paid: newPaid, manually_confirmed: newPaid } : i))
  }

  const paidInstallments = insts.filter(i => i.paid)
  const ltvCollected = paidInstallments.reduce((sum, i) => sum + i.amount, 0)

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} />
      <div className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-sm bg-white shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h2 className="font-bold text-gray-900">{client.full_name || client.ig_username}</h2>
            <p className="text-xs text-gray-400">@{client.ig_username}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* Overview */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Payment type', value: client.payment_type === 'pif' ? 'Paid in full' : client.payment_type === 'split' ? 'Split pay' : `Payment plan` },
              { label: 'Monthly', value: client.monthly_amount ? formatCurrency(client.monthly_amount, baseCurrency) : '—' },
              { label: 'LTV collected', value: formatCurrency(ltvCollected || client.total_amount, baseCurrency) },
              { label: 'Progress', value: client.plan_months ? `Month ${monthsElapsed + 1} of ${client.plan_months}` : 'Active' },
            ].map(item => (
              <div key={item.label} className="bg-gray-50 rounded-xl p-3">
                <p className="text-xs text-gray-500 mb-0.5">{item.label}</p>
                <p className="text-sm font-semibold text-gray-900">{item.value}</p>
              </div>
            ))}
          </div>

          {/* Payment dots */}
          {insts.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Payment tracker</p>
              <div className="flex flex-wrap gap-2">
                {[...insts].sort((a, b) => a.month_number - b.month_number).map(inst => (
                  <PaymentDot
                    key={inst.id}
                    installment={inst}
                    onToggle={() => togglePayment(inst.id, inst.paid)}
                  />
                ))}
              </div>
              <p className="text-xs text-gray-400 mt-2">Tap a dot to mark as paid/unpaid</p>
            </div>
          )}

          {/* Upsell reminder */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Upsell reminder</p>
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
              <div>
                <p className="text-sm font-medium text-gray-900">Remind me to upsell</p>
                <p className="text-xs text-gray-400">Creates a task at the selected month</p>
              </div>
              <button
                onClick={toggleUpsell}
                className={`relative w-12 h-6 rounded-full transition-colors ${upsellOn ? 'bg-purple-600' : 'bg-gray-200'}`}
              >
                <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${upsellOn ? 'translate-x-7' : 'translate-x-1'}`} />
              </button>
            </div>

            {upsellOn && (
              <div className="mt-3">
                <p className="text-xs text-gray-500 mb-2">Alert at month:</p>
                <div className="flex gap-2">
                  {[2, 3, 4, 5].map(m => (
                    <button
                      key={m}
                      onClick={() => setUpsellMonth(m)}
                      className={`w-10 h-10 rounded-xl text-sm font-semibold transition-all ${upsellMonth === m ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-700'}`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Notes</p>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={4}
              placeholder="Anything useful about this client…"
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
            <button
              onClick={saveNotes}
              disabled={saving || notes === client.notes}
              className="mt-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-40"
            >
              {saving ? 'Saving…' : 'Save notes'}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
