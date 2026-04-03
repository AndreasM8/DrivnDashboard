'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import { triggerSheetsSync } from '@/lib/sync-sheets-client'
import type { Client, PaymentInstallment } from '@/types'

interface Props {
  client: Client
  installments: PaymentInstallment[]
  baseCurrency: string
  onClose: () => void
  onUpdate: (updated: Client) => void
}

function fmt(amount: number, currency: string) {
  return new Intl.NumberFormat('en', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount)
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en', { day: 'numeric', month: 'short', year: 'numeric' })
}

function PaymentDot({ installment, onToggle }: { installment: PaymentInstallment; onToggle: () => void }) {
  const isPast = new Date(installment.due_date) < new Date()
  const bg = installment.paid ? 'var(--success)' : isPast ? 'var(--danger)' : 'var(--surface-3)'
  const border = installment.paid ? 'var(--success)' : isPast ? 'var(--danger)' : 'var(--border-strong)'
  const color = (installment.paid || isPast) ? '#fff' : 'var(--text-3)'

  return (
    <button
      onClick={onToggle}
      title={`Month ${installment.month_number} — due ${fmtDate(installment.due_date)} — ${installment.paid ? 'Paid' : 'Pending'}`}
      style={{ width: 36, height: 36, borderRadius: '50%', border: `2px solid ${border}`, background: bg, color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, cursor: 'pointer', transition: 'transform 150ms' }}
      onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.1)')}
      onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
    >
      {installment.month_number}
    </button>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  if (!value) return null
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
      <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{label}</span>
      <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-1)', textAlign: 'right', maxWidth: '60%' }}>{value}</span>
    </div>
  )
}

export default function ClientDrawer({ client, installments, baseCurrency, onClose, onUpdate }: Props) {
  const [notes, setNotes] = useState(client.notes)
  const [upsellOn, setUpsellOn] = useState(client.upsell_reminder_set)
  const [upsellMonth, setUpsellMonth] = useState(client.upsell_reminder_month ?? 3)
  const [saving, setSaving] = useState(false)
  const [insts, setInsts] = useState<PaymentInstallment[]>(installments)
  const [tab, setTab] = useState<'overview' | 'payments' | 'notes'>('overview')
  const [showExtend, setShowExtend] = useState(false)
  const [extendMonths, setExtendMonths] = useState(3)
  const [extendPayType, setExtendPayType] = useState<'plan' | 'pif'>('plan')
  const [extendAmount, setExtendAmount] = useState(client.monthly_amount ? String(client.monthly_amount) : '')
  const [extending, setExtending] = useState(false)
  const supabase = createClient()

  const totalContracted = client.total_amount
  const totalPaid = insts.filter(i => i.paid).reduce((sum, i) => sum + i.amount, 0)
  const totalOutstanding = Math.max(0, totalContracted - totalPaid)
  const paidPercent = totalContracted > 0 ? Math.round((totalPaid / totalContracted) * 100) : 0

  const startDate = new Date(client.started_at)
  const endDate = client.plan_months
    ? new Date(new Date(client.started_at).setMonth(startDate.getMonth() + client.plan_months))
    : null
  const monthsElapsed = Math.floor((Date.now() - startDate.getTime()) / (30 * 24 * 60 * 60 * 1000))
  const monthsRemaining = client.plan_months ? Math.max(0, client.plan_months - monthsElapsed) : null

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  async function saveNotes(value: string) {
    setSaving(true)
    const { data } = await supabase.from('clients').update({ notes: value }).eq('id', client.id).select().single()
    if (data) onUpdate(data as Client)
    setSaving(false)
  }

  function handleNotesChange(value: string) {
    setNotes(value)
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => saveNotes(value), 2000)
  }

  useEffect(() => () => { if (saveTimer.current) clearTimeout(saveTimer.current) }, [])

  async function extendContract() {
    if (!extendMonths || !extendAmount) return
    setExtending(true)
    const newPlanMonths = (client.plan_months ?? 0) + extendMonths
    const amt = Number(extendAmount)
    const addedTotal = extendPayType === 'plan' ? amt * extendMonths : amt
    const newTotal = client.total_amount + addedTotal

    const { data } = await supabase.from('clients').update({
      plan_months:    newPlanMonths,
      monthly_amount: extendPayType === 'plan' ? amt : client.monthly_amount,
      total_amount:   newTotal,
    }).eq('id', client.id).select().single()

    if (extendPayType === 'plan') {
      const lastMonth = insts.length > 0 ? Math.max(...insts.map(i => i.month_number)) : (client.plan_months ?? 0)
      const newInsts = Array.from({ length: extendMonths }, (_, i) => {
        const due = new Date(client.started_at)
        due.setMonth(due.getMonth() + lastMonth + i + 1)
        return {
          client_id:    client.id,
          month_number: lastMonth + i + 1,
          due_date:     due.toISOString().slice(0, 10),
          amount:       amt,
          paid:         false,
        }
      })
      const { data: newInstData } = await supabase.from('payment_installments').insert(newInsts).select()
      if (newInstData) setInsts(is => [...is, ...newInstData as PaymentInstallment[]])
    }

    if (extendPayType === 'pif') {
      const lastMonth = insts.length > 0 ? Math.max(...insts.map(i => i.month_number)) : (client.plan_months ?? 0)
      const due = new Date()
      const { data: newInstData } = await supabase.from('payment_installments').insert({
        client_id:    client.id,
        month_number: lastMonth + 1,
        due_date:     due.toISOString().slice(0, 10),
        amount:       amt,
        paid:         false,
      }).select()
      if (newInstData) setInsts(is => [...is, ...newInstData as PaymentInstallment[]])
    }

    if (data) onUpdate(data as Client)
    setShowExtend(false)
    setExtending(false)
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
    setInsts(is => is.map(i => i.id === instId ? { ...i, paid: newPaid, paid_at: newPaid ? new Date().toISOString() : null, manually_confirmed: newPaid } : i))
    const { error } = await supabase.from('payment_installments').update({
      paid: newPaid,
      paid_at: newPaid ? new Date().toISOString() : null,
      manually_confirmed: newPaid,
    }).eq('id', instId)
    if (error) {
      setInsts(is => is.map(i => i.id === instId ? { ...i, paid: currentPaid, manually_confirmed: currentPaid } : i))
      console.error('Failed to update payment:', error.message)
      return
    }
    triggerSheetsSync()
  }

  const progressBarColor = monthsRemaining !== null && monthsRemaining <= 1
    ? 'var(--danger)'
    : monthsRemaining !== null && monthsRemaining <= 2
      ? 'var(--warning)'
      : 'var(--accent)'

  return (
    <>
      <div style={{ position: 'fixed', inset: 0, zIndex: 40, background: 'rgba(0,0,0,0.3)' }} onClick={onClose} />
      <div style={{ position: 'fixed', right: 0, top: 0, bottom: 0, zIndex: 50, width: '100%', maxWidth: 384, background: 'var(--surface-1)', boxShadow: 'var(--shadow-dropdown)', display: 'flex', flexDirection: 'column' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
          <div>
            <h2 style={{ fontWeight: 700, color: 'var(--text-1)', margin: 0, fontSize: 16 }}>{client.full_name || client.ig_username}</h2>
            <p style={{ fontSize: 12, color: 'var(--text-3)', margin: '2px 0 0', fontFamily: 'var(--font-mono)' }}>
              @{client.ig_username}
              {client.program_type && (
                <span style={{ marginLeft: 8, color: 'var(--accent)' }}>· {client.program_type}</span>
              )}
            </p>
          </div>
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

        {/* LTV Summary bar */}
        <div style={{ padding: '16px 20px', background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
          <div className="grid grid-cols-3 gap-3" style={{ marginBottom: 12 }}>
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 2 }}>Contract value</p>
              <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-1)', margin: 0 }}>{fmt(totalContracted, baseCurrency)}</p>
            </div>
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 2 }}>Collected</p>
              <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--success)', margin: 0 }}>{fmt(totalPaid || (client.payment_type === 'pif' ? totalContracted : 0), baseCurrency)}</p>
            </div>
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 2 }}>Outstanding</p>
              <p style={{ fontSize: 14, fontWeight: 700, color: totalOutstanding > 0 ? 'var(--danger)' : 'var(--text-3)', margin: 0 }}>
                {fmt(client.payment_type === 'pif' ? 0 : totalOutstanding, baseCurrency)}
              </p>
            </div>
          </div>
          {client.plan_months && (
            <div style={{ marginTop: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-3)', marginBottom: 4 }}>
                <span>
                  Month <span style={{ fontWeight: 600, color: 'var(--text-1)' }}>{Math.min(monthsElapsed + 1, client.plan_months)}</span> of <span style={{ fontWeight: 600, color: 'var(--text-1)' }}>{client.plan_months}</span>
                </span>
                <span style={{ color: monthsRemaining !== null && monthsRemaining <= 1 ? 'var(--danger)' : monthsRemaining !== null && monthsRemaining <= 2 ? 'var(--warning)' : 'var(--text-3)', fontWeight: monthsRemaining !== null && monthsRemaining <= 2 ? 600 : 400 }}>
                  {monthsRemaining !== null && monthsRemaining > 0 ? `${monthsRemaining}mo left` : monthsRemaining === 0 ? 'Ending now' : 'Contract ended'}
                </span>
              </div>
              <div style={{ width: '100%', height: 4, background: 'var(--surface-3)', borderRadius: 99, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${Math.min(100, (monthsElapsed / client.plan_months) * 100)}%`, background: progressBarColor, borderRadius: 99 }} />
              </div>
            </div>
          )}
          {!client.plan_months && insts.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-3)', marginBottom: 4 }}>
                <span>{paidPercent}% collected</span>
                <span>{insts.filter(i => i.paid).length}/{insts.length} payments</span>
              </div>
              <div style={{ width: '100%', height: 4, background: 'var(--surface-3)', borderRadius: 99, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${paidPercent}%`, background: 'var(--success)', borderRadius: 99 }} />
              </div>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
          {(['overview', 'payments', 'notes'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                flex: 1, padding: '10px 0', fontSize: 12, fontWeight: 500, textTransform: 'capitalize', background: 'none', border: 'none', cursor: 'pointer',
                borderBottom: tab === t ? '2px solid var(--accent)' : '2px solid transparent',
                color: tab === t ? 'var(--accent)' : 'var(--text-2)',
                transition: 'color 120ms, border-color 120ms',
              }}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto">

          {/* Overview tab */}
          {tab === 'overview' && (
            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ background: 'var(--surface-1)', borderRadius: 'var(--radius-card)', border: '1px solid var(--border)' }}>
                <div style={{ padding: '0 12px' }}>
                  <InfoRow label="Start date" value={fmtDate(client.started_at)} />
                  {endDate && <InfoRow label="Contract ends" value={fmtDate(endDate.toISOString())} />}
                  {client.plan_months ? <InfoRow label="Duration" value={`${client.plan_months} months`} /> : null}
                  {monthsRemaining !== null && monthsRemaining > 0 && (
                    <InfoRow label="Months remaining" value={`${monthsRemaining} months`} />
                  )}
                  <InfoRow label="Payment type" value={
                    client.payment_type === 'pif' ? 'Paid in full' :
                    client.payment_type === 'split' ? 'Split pay' : 'Payment plan'
                  } />
                  {client.monthly_amount ? <InfoRow label="Monthly" value={fmt(client.monthly_amount, baseCurrency)} /> : null}
                  {client.email && <InfoRow label="Email" value={client.email} />}
                  {client.phone && <InfoRow label="Phone" value={client.phone} />}
                  {client.referred_by && <InfoRow label="Referred by" value={client.referred_by} />}
                </div>
              </div>

              {/* Upsell reminder */}
              <div>
                <p className="label-caps" style={{ marginBottom: 12 }}>Upsell reminder</p>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 12, background: 'var(--surface-2)', borderRadius: 'var(--radius-card)' }}>
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-1)', margin: 0 }}>Remind me to upsell</p>
                    <p style={{ fontSize: 12, color: 'var(--text-3)', margin: '2px 0 0' }}>Creates a task at the selected month</p>
                  </div>
                  <button
                    onClick={toggleUpsell}
                    style={{ position: 'relative', width: 44, height: 24, borderRadius: 12, background: upsellOn ? 'var(--purple)' : 'var(--surface-3)', border: 'none', cursor: 'pointer', padding: 0, transition: 'background 150ms', flexShrink: 0 }}
                  >
                    <span style={{ position: 'absolute', top: 4, width: 16, height: 16, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 2px rgba(0,0,0,0.2)', transition: 'transform 150ms ease', transform: upsellOn ? 'translateX(24px)' : 'translateX(4px)' }} />
                  </button>
                </div>
                {upsellOn && (
                  <div style={{ marginTop: 12 }}>
                    <p style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 8 }}>Alert at month:</p>
                    <div className="flex gap-2">
                      {[2, 3, 4, 5, 6].map(m => (
                        <button
                          key={m}
                          onClick={() => setUpsellMonth(m)}
                          style={{ width: 40, height: 40, borderRadius: 'var(--radius-card)', fontSize: 14, fontWeight: 600, border: 'none', cursor: 'pointer', transition: 'all 150ms', background: upsellMonth === m ? 'var(--purple)' : 'var(--surface-3)', color: upsellMonth === m ? '#fff' : 'var(--text-2)' }}
                        >
                          {m}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Extend contract */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <p className="label-caps">Extend contract</p>
                  <button
                    onClick={() => setShowExtend(v => !v)}
                    style={{ fontSize: 12, fontWeight: 500, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer' }}
                    onMouseEnter={e => (e.currentTarget.style.opacity = '0.7')}
                    onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
                  >
                    {showExtend ? 'Cancel' : '+ Extend'}
                  </button>
                </div>
                {showExtend && (
                  <div style={{ padding: 12, background: 'var(--surface-2)', borderRadius: 'var(--radius-card)', display: 'flex', flexDirection: 'column', gap: 12 }}>

                    {/* Duration */}
                    <div>
                      <p style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 8 }}>Months to add</p>
                      <div className="flex gap-1.5 flex-wrap">
                        {[1, 2, 3, 4, 6, 9, 12].map(m => (
                          <button
                            key={m}
                            onClick={() => setExtendMonths(m)}
                            style={{ width: 40, height: 40, borderRadius: 'var(--radius-btn)', fontSize: 14, fontWeight: 600, border: 'none', cursor: 'pointer', transition: 'all 150ms', background: extendMonths === m ? 'var(--accent)' : 'var(--surface-1)', color: extendMonths === m ? '#fff' : 'var(--text-2)' }}
                          >
                            {m}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Payment type */}
                    <div>
                      <p style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 8 }}>Payment type</p>
                      <div className="flex gap-2">
                        {(['plan', 'pif'] as const).map(t => (
                          <button
                            key={t}
                            onClick={() => { setExtendPayType(t); setExtendAmount('') }}
                            style={{
                              flex: 1, padding: '8px 0', borderRadius: 'var(--radius-btn)', fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 150ms',
                              background: extendPayType === t ? 'rgba(37,99,235,0.1)' : 'transparent',
                              color: extendPayType === t ? 'var(--accent)' : 'var(--text-2)',
                              border: `1px solid ${extendPayType === t ? 'var(--accent)' : 'var(--border)'}`,
                            }}
                          >
                            {t === 'plan' ? 'Payment plan' : 'Paid in full'}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Amount */}
                    <div>
                      <label style={{ display: 'block', fontSize: 12, color: 'var(--text-2)', marginBottom: 4 }}>
                        {extendPayType === 'plan' ? `Monthly amount (${baseCurrency})` : `Total upfront (${baseCurrency})`}
                      </label>
                      <input
                        type="number"
                        value={extendAmount}
                        onChange={e => setExtendAmount(e.target.value)}
                        placeholder={extendPayType === 'plan' && client.monthly_amount ? String(client.monthly_amount) : '0'}
                        className="input-base"
                      />
                    </div>

                    {/* Summary */}
                    {extendAmount && (
                      <div style={{ padding: 8, background: 'rgba(37,99,235,0.08)', borderRadius: 'var(--radius-btn)', fontSize: 12, textAlign: 'center' }}>
                        <p style={{ fontWeight: 600, color: 'var(--accent)', margin: 0 }}>
                          +{extendMonths} month{extendMonths !== 1 ? 's' : ''}
                          {extendPayType === 'plan'
                            ? ` · ${Number(extendAmount) * extendMonths} ${baseCurrency} total`
                            : ` · ${Number(extendAmount)} ${baseCurrency} upfront`}
                        </p>
                        {extendPayType === 'plan' && (
                          <p style={{ color: 'var(--accent)', opacity: 0.7, margin: '2px 0 0' }}>{extendMonths} installment{extendMonths !== 1 ? 's' : ''} of {extendAmount} {baseCurrency}</p>
                        )}
                        {extendPayType === 'pif' && (
                          <p style={{ color: 'var(--accent)', opacity: 0.7, margin: '2px 0 0' }}>1 payment due today</p>
                        )}
                      </div>
                    )}

                    <button
                      onClick={extendContract}
                      disabled={extending || !extendAmount}
                      className="btn-primary"
                      style={{ width: '100%', padding: '10px 0' }}
                    >
                      {extending ? 'Saving…' : 'Confirm extension'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Payments tab */}
          {tab === 'payments' && (
            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
              {insts.length > 0 ? (
                <>
                  <p style={{ fontSize: 12, color: 'var(--text-3)' }}>Tap a dot to mark as paid or unpaid</p>
                  <div className="flex flex-wrap gap-2">
                    {[...insts].sort((a, b) => a.month_number - b.month_number).map(inst => (
                      <PaymentDot
                        key={inst.id}
                        installment={inst}
                        onToggle={() => togglePayment(inst.id, inst.paid)}
                      />
                    ))}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 16 }}>
                    {[...insts].sort((a, b) => a.month_number - b.month_number).map(inst => (
                      <div
                        key={inst.id}
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderRadius: 'var(--radius-btn)', fontSize: 12,
                          background: inst.paid ? 'rgba(22,163,74,0.08)' : new Date(inst.due_date) < new Date() ? 'rgba(220,38,38,0.06)' : 'var(--surface-2)',
                        }}
                      >
                        <span style={{ fontWeight: 500, color: 'var(--text-1)' }}>Month {inst.month_number}</span>
                        <span style={{ color: 'var(--text-2)' }}>{fmtDate(inst.due_date)}</span>
                        <span style={{ fontWeight: 600, color: inst.paid ? 'var(--success)' : 'var(--text-3)' }}>
                          {inst.paid ? 'Paid' : fmt(inst.amount, baseCurrency)}
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-3)' }}>
                  <p style={{ fontSize: 14, margin: 0 }}>No payment installments</p>
                  <p style={{ fontSize: 12, marginTop: 4 }}>This client paid in full or split</p>
                </div>
              )}
            </div>
          )}

          {/* Notes tab */}
          {tab === 'notes' && (
            <div style={{ padding: 20 }}>
              <textarea
                value={notes}
                onChange={e => handleNotesChange(e.target.value)}
                rows={10}
                placeholder="Anything useful about this client — goals, objections handled, what they respond to…"
                className="input-base"
                style={{ resize: 'none' }}
              />
              <p style={{ marginTop: 8, fontSize: 12, color: 'var(--text-3)', textAlign: 'right' }}>
                {saving ? 'Saving…' : notes === client.notes ? 'Saved' : 'Auto-saves in 2s'}
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
