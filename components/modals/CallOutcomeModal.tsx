'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { triggerSheetsSync } from '@/lib/sync-sheets-client'
import type { Lead, CallOutcome, CallObjection, PaymentType } from '@/types'

interface Props {
  lead: Lead
  userId: string
  onClose: () => void
  onSaved: (updated: Lead, newClient?: boolean) => void
}

type Step = 'showed_up' | 'closed' | 'objection' | 'deal_details' | 'no_show_done'

const PLAN_MONTHS = [1, 2, 3, 4, 6, 9, 12]

export default function CallOutcomeModal({ lead, userId, onClose, onSaved }: Props) {
  const [step, setStep] = useState<Step>('showed_up')
  const [outcome, setOutcome] = useState<CallOutcome | null>(null)
  const [objection, setObjection] = useState<CallObjection | null>(null)
  const [objectionNotes, setObjectionNotes] = useState('')
  const [paymentType, setPaymentType] = useState<PaymentType>('pif')
  const [totalAmount, setTotalAmount] = useState('')
  const [monthlyAmount, setMonthlyAmount] = useState('')
  const [planMonths, setPlanMonths] = useState(3)
  const [loading, setLoading] = useState(false)

  const supabase = createClient()

  async function handleShowedUp(showed: boolean, callOutcome: CallOutcome) {
    setOutcome(callOutcome)
    if (!showed) {
      await saveOutcome(callOutcome, false)
      setStep('no_show_done')
    } else {
      setStep('closed')
    }
  }

  async function handleClosed(closed: boolean) {
    if (!closed) {
      setStep('objection')
    } else {
      setStep('deal_details')
    }
  }

  async function saveOutcome(callOutcome: CallOutcome, closed: boolean) {
    await supabase.from('leads').update({
      call_outcome: callOutcome,
      call_closed: closed,
      stage: closed ? 'closed' : 'call_booked',
      updated_at: new Date().toISOString(),
    }).eq('id', lead.id)

    await supabase.from('lead_history').insert({
      lead_id: lead.id,
      action: `Call outcome: ${callOutcome}`,
      actor: 'You',
    })
  }

  async function saveNotClosed() {
    setLoading(true)
    await supabase.from('leads').update({
      call_outcome: 'showed',
      call_closed: false,
      call_objection: objection,
      call_notes: objectionNotes,
      stage: 'nurture',
      updated_at: new Date().toISOString(),
    }).eq('id', lead.id)

    await supabase.from('lead_history').insert({
      lead_id: lead.id,
      action: `Call did not close — ${objection ?? 'no objection logged'}`,
      actor: 'You',
    })

    onSaved({ ...lead, call_outcome: 'showed', call_closed: false, stage: 'nurture' })
    triggerSheetsSync()
    setLoading(false)
  }

  async function saveDeal() {
    setLoading(true)

    // Update lead
    const { data: updatedLead } = await supabase.from('leads').update({
      call_outcome: 'showed',
      call_closed: true,
      stage: 'closed',
      updated_at: new Date().toISOString(),
    }).eq('id', lead.id).select().single()

    // Create client record
    const total = paymentType === 'plan'
      ? Number(monthlyAmount) * planMonths
      : Number(totalAmount)

    const { data: client } = await supabase.from('clients').insert({
      user_id: userId,
      lead_id: lead.id,
      ig_username: lead.ig_username,
      full_name: lead.full_name,
      payment_type: paymentType,
      plan_months: paymentType === 'plan' ? planMonths : null,
      monthly_amount: paymentType === 'plan' ? Number(monthlyAmount) : null,
      total_amount: total,
      started_at: new Date().toISOString(),
      closer_id: lead.closer_id,
    }).select().single()

    // Create payment installments for payment plan
    if (paymentType === 'plan' && client) {
      const installments = Array.from({ length: planMonths }, (_, i) => {
        const due = new Date()
        due.setMonth(due.getMonth() + i)
        return {
          client_id: client.id,
          month_number: i + 1,
          due_date: due.toISOString().slice(0, 10),
          amount: Number(monthlyAmount),
        }
      })
      await supabase.from('payment_installments').insert(installments)
    }

    await supabase.from('lead_history').insert({
      lead_id: lead.id,
      action: `Closed! Deal value: ${total}`,
      actor: 'You',
    })

    if (updatedLead) onSaved(updatedLead as Lead, true)
    triggerSheetsSync()
    setLoading(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-gray-900">Log call outcome</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        {/* Step 1 */}
        {step === 'showed_up' && (
          <div>
            <p className="text-sm font-medium text-gray-700 mb-4">Did @{lead.ig_username} show up?</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'Showed up ✓', outcome: 'showed' as CallOutcome, showed: true },
                { label: 'No-show', outcome: 'no_show' as CallOutcome, showed: false },
                { label: 'Canceled', outcome: 'canceled' as CallOutcome, showed: false },
                { label: 'Rescheduled', outcome: 'rescheduled' as CallOutcome, showed: false },
              ].map(opt => (
                <button
                  key={opt.outcome}
                  onClick={() => handleShowedUp(opt.showed, opt.outcome)}
                  className="py-3 px-4 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:border-blue-300 hover:bg-blue-50 transition-all"
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* No-show done */}
        {step === 'no_show_done' && (
          <div className="text-center py-4">
            <p className="text-2xl mb-3">📝</p>
            <p className="font-semibold text-gray-900 mb-1">Logged</p>
            <p className="text-sm text-gray-500 mb-5">Lead stays in pipeline. Follow up when you&apos;re ready.</p>
            <button onClick={onClose} className="w-full py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700">
              Done
            </button>
          </div>
        )}

        {/* Step 2 */}
        {step === 'closed' && (
          <div>
            <p className="text-sm font-medium text-gray-700 mb-4">Did it close?</p>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => handleClosed(true)}
                className="py-4 rounded-xl border-2 border-green-200 bg-green-50 text-sm font-semibold text-green-700 hover:border-green-400 transition-all"
              >
                🎉 Yes, closed!
              </button>
              <button
                onClick={() => handleClosed(false)}
                className="py-4 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:border-gray-300 hover:bg-gray-50 transition-all"
              >
                Not yet
              </button>
            </div>
          </div>
        )}

        {/* Step 3a — Objection */}
        {step === 'objection' && (
          <div>
            <p className="text-sm font-medium text-gray-700 mb-4">What was the main objection?</p>
            <div className="grid grid-cols-2 gap-2 mb-4">
              {[
                { value: 'money', label: 'Money' },
                { value: 'partner', label: 'Need to ask partner' },
                { value: 'timing', label: 'Bad timing' },
                { value: 'trust', label: 'Not ready / trust' },
                { value: 'other', label: 'Other' },
              ].map(o => (
                <button
                  key={o.value}
                  onClick={() => setObjection(o.value as CallObjection)}
                  className={`py-2.5 px-3 rounded-xl text-sm font-medium border transition-all text-left ${
                    objection === o.value
                      ? 'border-blue-400 bg-blue-50 text-blue-700'
                      : 'border-gray-200 text-gray-700 hover:border-gray-300'
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
            <textarea
              value={objectionNotes}
              onChange={e => setObjectionNotes(e.target.value)}
              placeholder="Any notes about the call…"
              rows={2}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none mb-4"
            />
            <div className="flex gap-3">
              <button onClick={() => setStep('closed')} className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-xl text-sm font-medium">Back</button>
              <button
                onClick={saveNotClosed}
                disabled={loading}
                className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium disabled:opacity-50"
              >
                {loading ? 'Saving…' : 'Log & move to nurture'}
              </button>
            </div>
          </div>
        )}

        {/* Step 3b — Deal details */}
        {step === 'deal_details' && (
          <div>
            <p className="text-sm font-medium text-gray-700 mb-4">🎉 How are they paying?</p>

            {/* Payment type */}
            <div className="flex gap-2 mb-4">
              {(['pif', 'split', 'plan'] as PaymentType[]).map(t => (
                <button
                  key={t}
                  onClick={() => setPaymentType(t)}
                  className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition-all ${
                    paymentType === t
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 text-gray-600'
                  }`}
                >
                  {t === 'pif' ? 'Paid in full' : t === 'split' ? 'Split pay' : 'Payment plan'}
                </button>
              ))}
            </div>

            {(paymentType === 'pif' || paymentType === 'split') && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Total amount</label>
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
              <div className="space-y-3 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Monthly amount</label>
                  <input
                    type="number"
                    value={monthlyAmount}
                    onChange={e => setMonthlyAmount(e.target.value)}
                    placeholder="0"
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Number of months</label>
                  <div className="flex gap-1.5 flex-wrap">
                    {PLAN_MONTHS.map(m => (
                      <button
                        key={m}
                        onClick={() => setPlanMonths(m)}
                        className={`w-10 h-10 rounded-lg text-sm font-semibold transition-all ${
                          planMonths === m ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>
                {monthlyAmount && (
                  <p className="text-xs text-gray-400">
                    Total: {Number(monthlyAmount) * planMonths} ({planMonths} months)
                  </p>
                )}
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={() => setStep('closed')} className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-xl text-sm font-medium">Back</button>
              <button
                onClick={saveDeal}
                disabled={loading || (!totalAmount && !monthlyAmount)}
                className="flex-1 py-2.5 bg-green-600 text-white rounded-xl text-sm font-semibold disabled:opacity-50"
              >
                {loading ? 'Saving…' : 'Save deal 🎉'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
