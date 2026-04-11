'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { triggerSheetsSync } from '@/lib/sync-sheets-client'
import type { Lead, CallOutcome, CallObjection, PaymentType, LeadStage } from '@/types'

interface Props {
  lead: Lead
  userId: string
  targetStage: LeadStage
  onClose: () => void
  onSaved: (updated: Lead, newClient?: boolean) => void
}

type Step = 'showed_up' | 'closed' | 'objection' | 'deal_details' | 'no_show_done'

const PLAN_MONTHS = [1, 2, 3, 4, 6, 9, 12]

export default function CallOutcomeModal({ lead, userId, targetStage, onClose, onSaved }: Props) {
  const [step, setStep] = useState<Step>('showed_up')
  const [outcome, setOutcome] = useState<CallOutcome | null>(null)
  const [objection, setObjection] = useState<CallObjection | null>(null)
  const [objectionNotes, setObjectionNotes] = useState('')
  const [paymentType, setPaymentType] = useState<PaymentType>('pif')
  const [totalAmount, setTotalAmount] = useState('')
  const [monthlyAmount, setMonthlyAmount] = useState('')
  const [planMonths, setPlanMonths] = useState(3)
  const [splitPayments, setSplitPayments] = useState(2)
  const [splitAmount, setSplitAmount] = useState('')
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
      // no-show/canceled/rescheduled → stay in current call stage; closed → closed
      stage: closed ? 'closed' : lead.stage,
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
      stage: targetStage,
      updated_at: new Date().toISOString(),
    }).eq('id', lead.id)

    await supabase.from('lead_history').insert({
      lead_id: lead.id,
      action: `Call did not close — ${objection ?? 'no objection logged'}`,
      actor: 'You',
    })

    onSaved({ ...lead, call_outcome: 'showed', call_closed: false, stage: targetStage })
    triggerSheetsSync()
    setLoading(false)
  }

  async function saveDeal() {
    setLoading(true)

    const { data: updatedLead } = await supabase.from('leads').update({
      call_outcome: 'showed',
      call_closed: true,
      stage: 'closed',
      updated_at: new Date().toISOString(),
    }).eq('id', lead.id).select().single()

    const total = paymentType === 'plan'
      ? Number(monthlyAmount) * planMonths
      : paymentType === 'split'
        ? Number(splitAmount) * splitPayments
        : Number(totalAmount)

    const { data: client } = await supabase.from('clients').insert({
      user_id: userId,
      lead_id: lead.id,
      ig_username: lead.ig_username,
      full_name: lead.full_name,
      payment_type: paymentType,
      plan_months: planMonths,
      monthly_amount: paymentType === 'plan' ? Number(monthlyAmount) : paymentType === 'split' ? Number(splitAmount) : null,
      total_amount: total,
      started_at: new Date().toISOString(),
      closer_id: lead.closer_id,
    }).select().single()

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
    if (paymentType === 'split' && client) {
      const installments = Array.from({ length: splitPayments }, (_, i) => {
        const due = new Date()
        due.setMonth(due.getMonth() + i)
        return {
          client_id: client.id,
          month_number: i + 1,
          due_date: due.toISOString().slice(0, 10),
          amount: Number(splitAmount),
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
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}>
      <div className="modal-enter" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-panel)', boxShadow: 'var(--shadow-dropdown)', width: '100%', maxWidth: 384, padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h2 className="section-title" style={{ margin: 0 }}>Log call outcome</h2>
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

        {/* Step 1 — showed up? */}
        {step === 'showed_up' && (
          <div>
            <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-1)', marginBottom: 16 }}>Did @{lead.ig_username} show up?</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'Showed up', outcome: 'showed' as CallOutcome, showed: true },
                { label: 'No-show', outcome: 'no_show' as CallOutcome, showed: false },
                { label: 'Canceled', outcome: 'canceled' as CallOutcome, showed: false },
                { label: 'Rescheduled', outcome: 'rescheduled' as CallOutcome, showed: false },
              ].map(opt => (
                <button
                  key={opt.outcome}
                  onClick={() => handleShowedUp(opt.showed, opt.outcome)}
                  style={{ padding: '12px 16px', borderRadius: 'var(--radius-card)', border: '1px solid var(--border)', fontSize: 14, fontWeight: 500, color: 'var(--text-1)', background: 'var(--surface-2)', cursor: 'pointer', transition: 'all 150ms' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.background = 'rgba(37,99,235,0.06)' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--surface-2)' }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* No-show done */}
        {step === 'no_show_done' && (
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <p style={{ fontWeight: 600, color: 'var(--text-1)', marginBottom: 4 }}>Logged</p>
            <p style={{ fontSize: 14, color: 'var(--text-2)', marginBottom: 20 }}>Lead stays in pipeline. Follow up when you&apos;re ready.</p>
            <button onClick={onClose} className="btn-primary" style={{ width: '100%', padding: '10px 0' }}>
              Done
            </button>
          </div>
        )}

        {/* Step 2 — closed? */}
        {step === 'closed' && (
          <div>
            <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-1)', marginBottom: 16 }}>Did it close?</p>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => handleClosed(true)}
                style={{ padding: '16px 0', borderRadius: 'var(--radius-card)', border: '2px solid rgba(22,163,74,0.4)', background: 'rgba(22,163,74,0.08)', fontSize: 14, fontWeight: 600, color: 'var(--success)', cursor: 'pointer', transition: 'all 150ms' }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--success)')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(22,163,74,0.4)')}
              >
                Yes, closed!
              </button>
              <button
                onClick={() => handleClosed(false)}
                style={{ padding: '16px 0', borderRadius: 'var(--radius-card)', border: '1px solid var(--border)', background: 'var(--surface-2)', fontSize: 14, fontWeight: 500, color: 'var(--text-1)', cursor: 'pointer', transition: 'all 150ms' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface-3)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'var(--surface-2)' }}
              >
                Not yet
              </button>
            </div>
          </div>
        )}

        {/* Step 3a — Objection */}
        {step === 'objection' && (
          <div>
            <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-1)', marginBottom: 16 }}>What was the main objection?</p>
            <div className="grid grid-cols-2 gap-2" style={{ marginBottom: 16 }}>
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
                  style={{
                    padding: '10px 12px', borderRadius: 'var(--radius-card)', fontSize: 14, fontWeight: 500, cursor: 'pointer', transition: 'all 150ms', textAlign: 'left',
                    background: objection === o.value ? 'rgba(37,99,235,0.1)' : 'var(--surface-2)',
                    color: objection === o.value ? 'var(--accent)' : 'var(--text-1)',
                    border: `1px solid ${objection === o.value ? 'var(--accent)' : 'var(--border)'}`,
                  }}
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
              className="input-base"
              style={{ resize: 'none', marginBottom: 16 }}
            />
            <div className="flex gap-3">
              <button onClick={() => setStep('closed')} className="btn-ghost" style={{ flex: 1, padding: '10px 0' }}>Back</button>
              <button
                onClick={saveNotClosed}
                disabled={loading}
                className="btn-primary"
                style={{ flex: 1, padding: '10px 0' }}
              >
                {loading ? 'Saving…' : 'Log & move to nurture'}
              </button>
            </div>
          </div>
        )}

        {/* Step 3b — Deal details */}
        {step === 'deal_details' && (
          <div>
            <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-1)', marginBottom: 16 }}>How are they paying?</p>

            {/* Payment type */}
            <div className="flex gap-2" style={{ marginBottom: 16 }}>
              {(['pif', 'split', 'plan'] as PaymentType[]).map(t => (
                <button
                  key={t}
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

            {paymentType === 'pif' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
                <div>
                  <label className="label-caps" style={{ display: 'block', marginBottom: 4 }}>Total amount</label>
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
                      <button key={m} onClick={() => setPlanMonths(m)}
                        style={{ width: 40, height: 40, borderRadius: 'var(--radius-btn)', fontSize: 14, fontWeight: 600, border: 'none', cursor: 'pointer', transition: 'all 150ms', background: planMonths === m ? 'var(--accent)' : 'var(--surface-3)', color: planMonths === m ? '#fff' : 'var(--text-2)' }}>
                        {m}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {paymentType === 'split' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
                <div>
                  <label className="label-caps" style={{ display: 'block', marginBottom: 8 }}>Number of payments</label>
                  <div className="flex gap-2">
                    {[2, 3, 4, 5, 6].map(n => (
                      <button key={n} onClick={() => setSplitPayments(n)}
                        style={{ width: 40, height: 40, borderRadius: 'var(--radius-btn)', fontSize: 14, fontWeight: 600, border: 'none', cursor: 'pointer', transition: 'all 150ms', background: splitPayments === n ? 'var(--accent)' : 'var(--surface-3)', color: splitPayments === n ? '#fff' : 'var(--text-2)' }}>
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="label-caps" style={{ display: 'block', marginBottom: 4 }}>Amount per payment</label>
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
                      <button key={m} onClick={() => setPlanMonths(m)}
                        style={{ width: 40, height: 40, borderRadius: 'var(--radius-btn)', fontSize: 14, fontWeight: 600, border: 'none', cursor: 'pointer', transition: 'all 150ms', background: planMonths === m ? 'var(--accent)' : 'var(--surface-3)', color: planMonths === m ? '#fff' : 'var(--text-2)' }}>
                        {m}
                      </button>
                    ))}
                  </div>
                </div>
                {splitAmount && (
                  <div style={{ padding: 8, background: 'rgba(37,99,235,0.08)', borderRadius: 'var(--radius-btn)', fontSize: 12, textAlign: 'center' }}>
                    <span style={{ fontWeight: 600, color: 'var(--accent)' }}>
                      {splitPayments} × {splitAmount} = {Number(splitAmount) * splitPayments} total
                    </span>
                  </div>
                )}
              </div>
            )}

            {paymentType === 'plan' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
                <div>
                  <label className="label-caps" style={{ display: 'block', marginBottom: 4 }}>Monthly amount</label>
                  <input
                    type="number"
                    value={monthlyAmount}
                    onChange={e => setMonthlyAmount(e.target.value)}
                    placeholder="0"
                    className="input-base"
                  />
                </div>
                <div>
                  <label className="label-caps" style={{ display: 'block', marginBottom: 8 }}>Months of collaboration</label>
                  <div className="flex gap-1.5 flex-wrap">
                    {PLAN_MONTHS.map(m => (
                      <button
                        key={m}
                        onClick={() => setPlanMonths(m)}
                        style={{ width: 40, height: 40, borderRadius: 'var(--radius-btn)', fontSize: 14, fontWeight: 600, border: 'none', cursor: 'pointer', transition: 'all 150ms', background: planMonths === m ? 'var(--accent)' : 'var(--surface-3)', color: planMonths === m ? '#fff' : 'var(--text-2)' }}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>
                {planMonths > 0 && (
                  <div style={{ padding: 12, background: 'rgba(37,99,235,0.08)', borderRadius: 'var(--radius-card)', textAlign: 'center' }}>
                    <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent)', margin: 0 }}>{planMonths} month{planMonths !== 1 ? 's' : ''} of coaching</p>
                    {monthlyAmount && (
                      <p style={{ fontSize: 12, color: 'var(--accent)', opacity: 0.7, marginTop: 2 }}>
                        {Number(monthlyAmount) * planMonths} total
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={() => setStep('closed')} className="btn-ghost" style={{ flex: 1, padding: '10px 0' }}>Back</button>
              <button
                onClick={saveDeal}
                disabled={
                  loading ||
                  (paymentType === 'pif'   && !totalAmount) ||
                  (paymentType === 'split' && !splitAmount) ||
                  (paymentType === 'plan'  && (!monthlyAmount || planMonths < 1))
                }
                style={{ flex: 1, padding: '10px 0', borderRadius: 'var(--radius-btn)', fontSize: 14, fontWeight: 600, border: 'none', cursor: 'pointer', background: 'var(--success)', color: '#fff', opacity: loading ? 0.5 : 1, transition: 'opacity 150ms' }}
              >
                {loading ? 'Saving…' : 'Save deal'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
