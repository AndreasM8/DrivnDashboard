'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import type { EodReport, Setter } from '@/types'

interface Props {
  userId: string
  setters: Setter[]
  todayReport: EodReport | null
  reports: EodReport[]
}

// ─── Setter EOD form ──────────────────────────────────────────────────────────

function EodForm({ userId, setters, existingReport, onSubmitted }: {
  userId: string
  setters: Setter[]
  existingReport: EodReport | null
  onSubmitted: (report: EodReport) => void
}) {
  const selfSetter = setters.find(s => s.is_self)
  const [setterId, setSetterId] = useState(selfSetter?.id ?? setters[0]?.id ?? '')
  const [editing, setEditing] = useState(!existingReport)
  const [fields, setFields] = useState({
    leads_contacted: String(existingReport?.leads_contacted ?? ''),
    new_leads_added: String(existingReport?.new_leads_added ?? ''),
    freebies_sent: String(existingReport?.freebies_sent ?? ''),
    calls_booked: String(existingReport?.calls_booked ?? ''),
    calls_held: String(existingReport?.calls_held ?? ''),
    calls_closed: String(existingReport?.calls_closed ?? ''),
    total_cash_collected: String(existingReport?.total_cash_collected ?? ''),
    biggest_win: existingReport?.biggest_win ?? '',
    biggest_challenge: existingReport?.biggest_challenge ?? '',
    notes: existingReport?.notes ?? '',
  })
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const today = new Date().toISOString().slice(0, 10)
    const payload = {
      workspace_id: userId,
      setter_id: setterId,
      date: today,
      leads_contacted: Number(fields.leads_contacted) || 0,
      new_leads_added: Number(fields.new_leads_added) || 0,
      freebies_sent: Number(fields.freebies_sent) || 0,
      calls_booked: Number(fields.calls_booked) || 0,
      calls_held: Number(fields.calls_held) || 0,
      calls_closed: Number(fields.calls_closed) || 0,
      total_cash_collected: Number(fields.total_cash_collected) || 0,
      biggest_win: fields.biggest_win,
      biggest_challenge: fields.biggest_challenge,
      notes: fields.notes,
      submitted_at: new Date().toISOString(),
    }

    const { data } = existingReport
      ? await supabase.from('eod_reports').update(payload).eq('id', existingReport.id).select().single()
      : await supabase.from('eod_reports').insert(payload).select().single()

    if (data) {
      onSubmitted(data as EodReport)
      setEditing(false)
    }
    setLoading(false)
  }

  if (existingReport && !editing) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="font-bold text-gray-900 dark:text-slate-100">Today&apos;s report submitted ✓</h2>
            <p className="text-sm text-gray-400 dark:text-slate-500 mt-0.5">{new Date(existingReport.submitted_at).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' })}</p>
          </div>
          <button onClick={() => setEditing(true)} className="text-sm text-blue-600 font-medium hover:text-blue-700">Edit</button>
        </div>

        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 mb-5">
          {[
            { label: 'Leads contacted', value: existingReport.leads_contacted },
            { label: 'New leads', value: existingReport.new_leads_added },
            { label: 'Freebies', value: existingReport.freebies_sent },
            { label: 'Calls booked', value: existingReport.calls_booked },
            { label: 'Calls held', value: existingReport.calls_held },
            { label: 'Closed', value: existingReport.calls_closed },
          ].map(s => (
            <div key={s.label} className="bg-gray-50 dark:bg-slate-700 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-gray-900 dark:text-slate-100">{s.value}</p>
              <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {existingReport.biggest_win && (
          <div className="bg-green-50 dark:bg-green-900/20 rounded-xl px-4 py-3 mb-3">
            <p className="text-xs font-semibold text-green-700 dark:text-green-400 mb-1">Biggest win</p>
            <p className="text-sm text-green-800 dark:text-green-300">{existingReport.biggest_win}</p>
          </div>
        )}
        {existingReport.biggest_challenge && (
          <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl px-4 py-3">
            <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 mb-1">Biggest challenge</p>
            <p className="text-sm text-amber-800 dark:text-amber-300">{existingReport.biggest_challenge}</p>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 p-6">
      <h2 className="text-lg font-bold text-gray-900 dark:text-slate-100 mb-1">How did today go?</h2>
      <p className="text-sm text-gray-400 dark:text-slate-500 mb-6">{new Date().toLocaleDateString('en', { weekday: 'long', month: 'long', day: 'numeric' })}</p>

      {setters.length > 1 && (
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Submitting as</label>
          <select
            value={setterId}
            onChange={e => setSetterId(e.target.value)}
            className="w-full px-3 py-2.5 border border-gray-200 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {setters.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[
            { key: 'leads_contacted', label: 'Leads contacted' },
            { key: 'new_leads_added', label: 'New leads added' },
            { key: 'freebies_sent', label: 'Freebies sent' },
            { key: 'calls_booked', label: 'Calls booked' },
            { key: 'calls_held', label: 'Calls held' },
            { key: 'calls_closed', label: 'Calls closed' },
          ].map(f => (
            <div key={f.key}>
              <label className="block text-xs font-medium text-gray-600 dark:text-slate-400 mb-1">{f.label}</label>
              <input
                type="number"
                min="0"
                value={fields[f.key as keyof typeof fields]}
                onChange={e => setFields(fs => ({ ...fs, [f.key]: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-lg text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          ))}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Cash collected today</label>
          <input
            type="number"
            min="0"
            value={fields.total_cash_collected}
            onChange={e => setFields(fs => ({ ...fs, total_cash_collected: e.target.value }))}
            placeholder="0"
            className="w-full px-3 py-2.5 border border-gray-200 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Biggest win today</label>
          <textarea
            value={fields.biggest_win}
            onChange={e => setFields(fs => ({ ...fs, biggest_win: e.target.value }))}
            placeholder="e.g. booked 3 calls, great conversation with…"
            rows={2}
            className="w-full px-3 py-2.5 border border-gray-200 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Biggest challenge</label>
          <textarea
            value={fields.biggest_challenge}
            onChange={e => setFields(fs => ({ ...fs, biggest_challenge: e.target.value }))}
            placeholder="e.g. lots of no-replies, money objection on 2 calls"
            rows={2}
            className="w-full px-3 py-2.5 border border-gray-200 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Anything else <span className="text-gray-400 dark:text-slate-500 font-normal">(optional)</span></label>
          <textarea
            value={fields.notes}
            onChange={e => setFields(fs => ({ ...fs, notes: e.target.value }))}
            placeholder="Any other notes for your coach…"
            rows={2}
            className="w-full px-3 py-2.5 border border-gray-200 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {loading ? 'Submitting…' : 'Submit today\'s report'}
        </button>
      </form>
    </div>
  )
}

// ─── Owner report feed ────────────────────────────────────────────────────────

function ReportFeed({ reports, setters }: { reports: EodReport[]; setters: Setter[] }) {
  const [expanded, setExpanded] = useState<string | null>(null)

  if (reports.length === 0) {
    return (
      <div className="text-center py-12 bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700">
        <p className="text-2xl mb-3">📋</p>
        <p className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-1">No reports yet</p>
        <p className="text-sm text-gray-500 dark:text-slate-400">EOD reports from your team will appear here.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {reports.map(r => {
        const setter = setters.find(s => s.id === r.setter_id)
        const isExpanded = expanded === r.id
        return (
          <div key={r.id} className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 p-4">
            <div className="flex items-start gap-3 mb-3">
              <div className="w-9 h-9 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-bold text-sm flex items-center justify-center flex-shrink-0">
                {(setter?.name ?? 'U').charAt(0)}
              </div>
              <div className="flex-1">
                <p className="font-semibold text-gray-900 dark:text-slate-100 text-sm">{setter?.name ?? 'Unknown'}</p>
                <p className="text-xs text-gray-400 dark:text-slate-500">{new Date(r.date).toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric' })}</p>
              </div>
            </div>

            <div className="flex items-center gap-4 text-sm mb-3 flex-wrap">
              <span className="text-gray-600 dark:text-slate-400">{r.leads_contacted} leads</span>
              <span className="text-gray-600 dark:text-slate-400">{r.calls_booked} booked</span>
              <span className="text-gray-600 dark:text-slate-400">{r.calls_closed} closed</span>
              {r.total_cash_collected > 0 && (
                <span className="font-semibold text-green-700 dark:text-green-400">{r.total_cash_collected.toLocaleString()}</span>
              )}
            </div>

            {r.biggest_win && (
              <div className="bg-green-50 dark:bg-green-900/20 rounded-lg px-3 py-2 mb-2">
                <p className="text-xs font-semibold text-green-700 dark:text-green-400 mb-0.5">Win</p>
                <p className="text-xs text-green-800 dark:text-green-300 line-clamp-2">{r.biggest_win}</p>
              </div>
            )}
            {r.biggest_challenge && (
              <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg px-3 py-2 mb-2">
                <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 mb-0.5">Challenge</p>
                <p className="text-xs text-amber-800 dark:text-amber-300 line-clamp-2">{r.biggest_challenge}</p>
              </div>
            )}

            {(r.notes || r.calls_held > 0) && (
              <button
                onClick={() => setExpanded(isExpanded ? null : r.id)}
                className="text-xs text-blue-600 hover:text-blue-700 font-medium mt-1"
              >
                {isExpanded ? 'Show less' : 'Show more'}
              </button>
            )}

            {isExpanded && (
              <div className="mt-3 pt-3 border-t border-gray-50 dark:border-slate-700 text-xs text-gray-600 dark:text-slate-400 space-y-1">
                <p>Calls held: {r.calls_held}</p>
                <p>Freebies sent: {r.freebies_sent}</p>
                {r.notes && <p className="text-gray-500 dark:text-slate-500 mt-2">{r.notes}</p>}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function EodClient({ userId, setters, todayReport, reports }: Props) {
  const [currentTodayReport, setCurrentTodayReport] = useState<EodReport | null>(todayReport)
  const [allReports, setAllReports] = useState<EodReport[]>(reports)

  function onSubmitted(report: EodReport) {
    setCurrentTodayReport(report)
    setAllReports(rs => [report, ...rs.filter(r => r.id !== report.id)])
  }

  // Weekly summary totals
  const weekStart = new Date()
  weekStart.setDate(weekStart.getDate() - 7)
  const weekReports = allReports.filter(r => new Date(r.date) >= weekStart)

  const weekTotals = weekReports.reduce((acc, r) => ({
    leads: acc.leads + r.leads_contacted,
    booked: acc.booked + r.calls_booked,
    closed: acc.closed + r.calls_closed,
    cash: acc.cash + r.total_cash_collected,
  }), { leads: 0, booked: 0, closed: 0, cash: 0 })

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center px-6 py-4 border-b border-gray-100 dark:border-slate-700 bg-white dark:bg-slate-900">
        <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100">EOD Reports</h1>
      </div>

      <div className="flex-1 overflow-y-auto p-6 max-w-3xl space-y-8 bg-gray-50 dark:bg-slate-900">
        {/* Guard: need at least one setter to submit */}
        {setters.length === 0 ? (
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 p-8 text-center">
            <p className="text-3xl mb-3">👋</p>
            <p className="font-semibold text-gray-900 dark:text-slate-100 mb-1">Set up your team first</p>
            <p className="text-sm text-gray-500 dark:text-slate-400">
              EOD reports are submitted per team member. Go to{' '}
              <a href="/settings" className="text-blue-600 hover:underline">Settings → Team</a>{' '}
              to add yourself or your setters.
            </p>
          </div>
        ) : (
        <EodForm
          userId={userId}
          setters={setters}
          existingReport={currentTodayReport}
          onSubmitted={onSubmitted}
        />
        )}

        {/* This week summary */}
        {weekReports.length > 0 && (
          <div>
            <h2 className="font-semibold text-gray-900 dark:text-slate-100 mb-3">This week</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Leads contacted', value: weekTotals.leads },
                { label: 'Calls booked', value: weekTotals.booked },
                { label: 'Calls closed', value: weekTotals.closed },
                { label: 'Cash collected', value: weekTotals.cash.toLocaleString() },
              ].map(s => (
                <div key={s.label} className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 p-4 text-center">
                  <p className="text-2xl font-bold text-gray-900 dark:text-slate-100">{s.value}</p>
                  <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Report feed */}
        <div>
          <h2 className="font-semibold text-gray-900 dark:text-slate-100 mb-3">Report history</h2>
          <ReportFeed reports={allReports} setters={setters} />
        </div>
      </div>
    </div>
  )
}
