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
  const color = installment.paid
    ? 'bg-green-400 border-green-400 text-white'
    : isPast
      ? 'bg-red-400 border-red-400 text-white'
      : 'bg-gray-100 border-gray-300 text-gray-500'

  return (
    <button
      onClick={onToggle}
      title={`Month ${installment.month_number} — due ${fmtDate(installment.due_date)} — ${installment.paid ? '✓ Paid' : 'Pending'}`}
      className={`w-9 h-9 rounded-full border-2 flex items-center justify-center text-xs font-bold transition-all hover:scale-110 ${color}`}
    >
      {installment.month_number}
    </button>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  if (!value) return null
  return (
    <div className="flex justify-between items-center py-2 border-b border-gray-50 dark:border-slate-700 last:border-0">
      <span className="text-xs text-gray-500 dark:text-slate-400">{label}</span>
      <span className="text-xs font-medium text-gray-900 dark:text-slate-100 text-right max-w-[60%]">{value}</span>
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
  const supabase = createClient()

  // LTV calculations
  const totalContracted = client.total_amount
  const totalPaid = insts.filter(i => i.paid).reduce((sum, i) => sum + i.amount, 0)
  const totalOutstanding = Math.max(0, totalContracted - totalPaid)
  const paidPercent = totalContracted > 0 ? Math.round((totalPaid / totalContracted) * 100) : 0

  // Contract dates
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

  // Flush on unmount
  useEffect(() => () => { if (saveTimer.current) clearTimeout(saveTimer.current) }, [])

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
    // Optimistic update
    setInsts(is => is.map(i => i.id === instId ? { ...i, paid: newPaid, paid_at: newPaid ? new Date().toISOString() : null, manually_confirmed: newPaid } : i))
    const { error } = await supabase.from('payment_installments').update({
      paid: newPaid,
      paid_at: newPaid ? new Date().toISOString() : null,
      manually_confirmed: newPaid,
    }).eq('id', instId)
    if (error) {
      // Revert optimistic update on failure
      setInsts(is => is.map(i => i.id === instId ? { ...i, paid: currentPaid, manually_confirmed: currentPaid } : i))
      console.error('Failed to update payment:', error.message)
      return
    }
    // Sync sheets after any payment confirmation
    triggerSheetsSync()
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} />
      <div className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-sm bg-white dark:bg-slate-800 shadow-2xl flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-slate-700">
          <div>
            <h2 className="font-bold text-gray-900 dark:text-slate-100">{client.full_name || client.ig_username}</h2>
            <p className="text-xs text-gray-400 dark:text-slate-500">
              @{client.ig_username}
              {client.program_type && (
                <span className="ml-2 text-blue-500">· {client.program_type}</span>
              )}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300">
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        {/* LTV Summary bar */}
        <div className="px-5 py-4 bg-gray-50 dark:bg-slate-900 border-b border-gray-100 dark:border-slate-700">
          <div className="grid grid-cols-3 gap-3 mb-3">
            <div className="text-center">
              <p className="text-xs text-gray-400 dark:text-slate-500 mb-0.5">Contract value</p>
              <p className="text-sm font-bold text-gray-900 dark:text-slate-100">{fmt(totalContracted, baseCurrency)}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-400 dark:text-slate-500 mb-0.5">Collected</p>
              <p className="text-sm font-bold text-green-600">{fmt(totalPaid || (client.payment_type === 'pif' ? totalContracted : 0), baseCurrency)}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-400 dark:text-slate-500 mb-0.5">Outstanding</p>
              <p className={`text-sm font-bold ${totalOutstanding > 0 ? 'text-red-500' : 'text-gray-400'}`}>
                {fmt(client.payment_type === 'pif' ? 0 : totalOutstanding, baseCurrency)}
              </p>
            </div>
          </div>
          {insts.length > 0 && (
            <div>
              <div className="flex justify-between text-xs text-gray-400 dark:text-slate-500 mb-1">
                <span>{paidPercent}% collected</span>
                <span>{insts.filter(i => i.paid).length}/{insts.length} payments</span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-slate-700 rounded-full h-1.5">
                <div className="bg-green-500 h-1.5 rounded-full transition-all" style={{ width: `${paidPercent}%` }} />
              </div>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100 dark:border-slate-700">
          {(['overview', 'payments', 'notes'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2.5 text-xs font-medium capitalize transition-colors ${
                tab === t ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-300'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto">

          {/* Overview tab */}
          {tab === 'overview' && (
            <div className="p-5 space-y-4">
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 divide-y divide-gray-50 dark:divide-slate-700">
                <InfoRow label="Start date" value={fmtDate(client.started_at)} />
                {endDate && <InfoRow label="Contract ends" value={fmtDate(endDate.toISOString())} />}
                {client.plan_months && <InfoRow label="Duration" value={`${client.plan_months} months`} />}
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

              {/* Upsell reminder */}
              <div>
                <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide mb-3">Upsell reminder</p>
                <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-700 rounded-xl">
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-slate-100">Remind me to upsell</p>
                    <p className="text-xs text-gray-400 dark:text-slate-500">Creates a task at the selected month</p>
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
                    <p className="text-xs text-gray-500 dark:text-slate-400 mb-2">Alert at month:</p>
                    <div className="flex gap-2">
                      {[2, 3, 4, 5, 6].map(m => (
                        <button
                          key={m}
                          onClick={() => setUpsellMonth(m)}
                          className={`w-10 h-10 rounded-xl text-sm font-semibold transition-all ${upsellMonth === m ? 'bg-purple-600 text-white' : 'bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-300'}`}
                        >
                          {m}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Payments tab */}
          {tab === 'payments' && (
            <div className="p-5 space-y-4">
              {insts.length > 0 ? (
                <>
                  <p className="text-xs text-gray-400 dark:text-slate-500">Tap a dot to mark as paid or unpaid</p>
                  <div className="flex flex-wrap gap-2">
                    {[...insts].sort((a, b) => a.month_number - b.month_number).map(inst => (
                      <PaymentDot
                        key={inst.id}
                        installment={inst}
                        onToggle={() => togglePayment(inst.id, inst.paid)}
                      />
                    ))}
                  </div>
                  <div className="space-y-2 mt-4">
                    {[...insts].sort((a, b) => a.month_number - b.month_number).map(inst => (
                      <div
                        key={inst.id}
                        className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs ${
                          inst.paid ? 'bg-green-50 dark:bg-green-900/20' : new Date(inst.due_date) < new Date() ? 'bg-red-50 dark:bg-red-900/20' : 'bg-gray-50 dark:bg-slate-700'
                        }`}
                      >
                        <span className="font-medium text-gray-700 dark:text-slate-300">Month {inst.month_number}</span>
                        <span className="text-gray-500 dark:text-slate-400">{fmtDate(inst.due_date)}</span>
                        <span className={`font-semibold ${inst.paid ? 'text-green-600' : 'text-gray-400'}`}>
                          {inst.paid ? '✓ Paid' : fmt(inst.amount, baseCurrency)}
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="text-center py-8 text-gray-400 dark:text-slate-500">
                  <p className="text-sm">No payment installments</p>
                  <p className="text-xs mt-1">This client paid in full or split</p>
                </div>
              )}
            </div>
          )}

          {/* Notes tab */}
          {tab === 'notes' && (
            <div className="p-5">
              <textarea
                value={notes}
                onChange={e => handleNotesChange(e.target.value)}
                rows={10}
                placeholder="Anything useful about this client — goals, objections handled, what they respond to…"
                className="w-full px-3 py-2.5 border border-gray-200 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
              <p className="mt-2 text-xs text-gray-400 dark:text-slate-500 text-right">
                {saving ? '💾 Saving…' : notes === client.notes ? '✓ Saved' : 'Auto-saves in 2s'}
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
