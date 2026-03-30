'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import type { Lead, LeadLabel, LeadLabelAssignment, LeadStage, Setter, LeadHistory } from '@/types'
import { STAGE_LABELS } from '@/types'

interface Props {
  lead: Lead
  labels: LeadLabel[]
  assignments: LeadLabelAssignment[]
  setters: Setter[]
  onClose: () => void
  onUpdate: (updated: Lead) => void
  onStageChange: (stage: LeadStage) => void
  onAssignmentsChanged: (assignments: LeadLabelAssignment[]) => void
}

const MOVEABLE_STAGES: LeadStage[] = ['follower', 'replied', 'freebie_sent', 'call_booked', 'closed', 'nurture', 'bad_fit', 'not_interested']

// ─── Stage badge config ───────────────────────────────────────────────────────

const STAGE_BADGE: Record<LeadStage, { bg: string; text: string; dot: string }> = {
  follower:       { bg: 'bg-gray-100 dark:bg-gray-800',    text: 'text-gray-600 dark:text-gray-400',    dot: 'bg-gray-400' },
  replied:        { bg: 'bg-blue-50 dark:bg-blue-900/30',  text: 'text-blue-700 dark:text-blue-300',    dot: 'bg-blue-500' },
  freebie_sent:   { bg: 'bg-purple-50 dark:bg-purple-900/30', text: 'text-purple-700 dark:text-purple-300', dot: 'bg-purple-500' },
  call_booked:    { bg: 'bg-orange-50 dark:bg-orange-900/30', text: 'text-orange-700 dark:text-orange-300', dot: 'bg-orange-500' },
  closed:         { bg: 'bg-green-50 dark:bg-green-900/30',  text: 'text-green-700 dark:text-green-300',  dot: 'bg-green-500' },
  nurture:        { bg: 'bg-teal-50 dark:bg-teal-900/30',   text: 'text-teal-700 dark:text-teal-300',    dot: 'bg-teal-500' },
  bad_fit:        { bg: 'bg-rose-50 dark:bg-rose-900/30',   text: 'text-rose-700 dark:text-rose-300',    dot: 'bg-rose-400' },
  not_interested: { bg: 'bg-gray-100 dark:bg-gray-800',    text: 'text-gray-500 dark:text-gray-500',    dot: 'bg-gray-400' },
}

// ─── Timeline icon helpers ─────────────────────────────────────────────────────

function historyMeta(action: string): { bg: string; textColor: string; icon: React.ReactNode } {
  const a = action.toLowerCase()

  // Added to pipeline
  if (a.includes('added') || a.includes('created') || a.includes('pipeline')) {
    return {
      bg: 'bg-purple-100 dark:bg-purple-900/40',
      textColor: 'text-purple-600 dark:text-purple-300',
      icon: (
        <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
          <path d="M10 9a3 3 0 100-6 3 3 0 000 6zM6 8a2 2 0 11-4 0 2 2 0 014 0zM1.49 15.326a.78.78 0 01-.358-.442 3 3 0 014.308-3.516 6.484 6.484 0 00-1.905 3.959c-.023.222-.014.442.025.654a4.97 4.97 0 01-2.07-.655zM16.44 15.98a4.97 4.97 0 002.07-.654.78.78 0 00.357-.442 3 3 0 00-4.308-3.517 6.484 6.484 0 011.907 3.96 2.32 2.32 0 01-.026.654zM18 8a2 2 0 11-4 0 2 2 0 014 0zM5.304 16.19a.844.844 0 01-.277-.71 5 5 0 019.947 0 .843.843 0 01-.277.71A6.975 6.975 0 0110 18a6.974 6.974 0 01-4.696-1.81z" />
        </svg>
      ),
    }
  }

  // Stage moved
  if (a.includes('moved') || a.includes('stage') || a.includes('→') || a.includes('->')) {
    return {
      bg: 'bg-blue-100 dark:bg-blue-900/40',
      textColor: 'text-blue-600 dark:text-blue-300',
      icon: (
        <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
          <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
        </svg>
      ),
    }
  }

  // Call booked
  if (a.includes('call') && (a.includes('book') || a.includes('sched'))) {
    return {
      bg: 'bg-orange-100 dark:bg-orange-900/40',
      textColor: 'text-orange-600 dark:text-orange-300',
      icon: (
        <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
          <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
        </svg>
      ),
    }
  }

  // Closed / outcome / won
  if (a.includes('closed') || a.includes('won') || a.includes('outcome') || a.includes('showed')) {
    return {
      bg: 'bg-green-100 dark:bg-green-900/40',
      textColor: 'text-green-600 dark:text-green-300',
      icon: (
        <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
        </svg>
      ),
    }
  }

  // No show / not interested / lost
  if (a.includes('no.show') || a.includes('no show') || a.includes('not interested') || a.includes('lost') || a.includes('bad fit')) {
    return {
      bg: 'bg-red-100 dark:bg-red-900/40',
      textColor: 'text-red-600 dark:text-red-300',
      icon: (
        <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
          <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
      ),
    }
  }

  // Label / tag
  if (a.includes('label') || a.includes('tag')) {
    return {
      bg: 'bg-amber-100 dark:bg-amber-900/40',
      textColor: 'text-amber-600 dark:text-amber-300',
      icon: (
        <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
          <path fillRule="evenodd" d="M17.707 9.293a1 1 0 010 1.414l-7 7a1 1 0 01-1.414 0l-7-7A.997.997 0 012 10V5a3 3 0 013-3h5c.256 0 .512.098.707.293l7 7zM5 6a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
        </svg>
      ),
    }
  }

  // Tier
  if (a.includes('tier')) {
    return {
      bg: 'bg-yellow-100 dark:bg-yellow-900/40',
      textColor: 'text-yellow-600 dark:text-yellow-300',
      icon: (
        <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ),
    }
  }

  // Notes
  if (a.includes('note')) {
    return {
      bg: 'bg-slate-100 dark:bg-slate-700',
      textColor: 'text-slate-600 dark:text-slate-400',
      icon: (
        <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
          <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
        </svg>
      ),
    }
  }

  // Freebie / link sent
  if (a.includes('freebie') || a.includes('link') || a.includes('sent')) {
    return {
      bg: 'bg-indigo-100 dark:bg-indigo-900/40',
      textColor: 'text-indigo-600 dark:text-indigo-300',
      icon: (
        <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
          <path fillRule="evenodd" d="M12.586 4.586a2 2 0 112.828 2.828l-3 3a2 2 0 01-2.828 0 1 1 0 00-1.414 1.414 4 4 0 005.656 0l3-3a4 4 0 00-5.656-5.656l-1.5 1.5a1 1 0 101.414 1.414l1.5-1.5zm-5 5a2 2 0 012.828 0 1 1 0 101.414-1.414 4 4 0 00-5.656 0l-3 3a4 4 0 105.656 5.656l1.5-1.5a1 1 0 10-1.414-1.414l-1.5 1.5a2 2 0 11-2.828-2.828l3-3z" clipRule="evenodd" />
        </svg>
      ),
    }
  }

  // Default
  return {
    bg: 'bg-slate-100 dark:bg-slate-700',
    textColor: 'text-slate-500 dark:text-slate-400',
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
      </svg>
    ),
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(dateStr: string) {
  const d = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(d / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const days = Math.floor(h / 24)
  if (days < 7) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString('en', { month: 'short', day: 'numeric' })
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function LeadDrawer({ lead, labels, assignments, setters, onClose, onUpdate, onStageChange, onAssignmentsChanged }: Props) {
  const [activeTab, setActiveTab] = useState<'info' | 'timeline'>('info')
  const [notes, setNotes] = useState(lead.setter_notes)
  const [history, setHistory] = useState<LeadHistory[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyError, setHistoryError] = useState(false)
  const [saving, setSaving] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    setHistoryLoading(true)
    setHistoryError(false)
    supabase.from('lead_history').select('*').eq('lead_id', lead.id)
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        setHistoryLoading(false)
        if (error) { setHistoryError(true); return }
        setHistory((data as LeadHistory[]) ?? [])
      })
  }, [lead.id])

  // Keep notes in sync if lead changes externally
  useEffect(() => { setNotes(lead.setter_notes) }, [lead.setter_notes])

  async function saveNotes() {
    setSaving(true)
    const { data } = await supabase.from('leads')
      .update({ setter_notes: notes, updated_at: new Date().toISOString() })
      .eq('id', lead.id).select().single()
    if (data) onUpdate(data as Lead)
    setSaving(false)
  }

  async function setTier(tier: 1 | 2 | 3) {
    const { data } = await supabase.from('leads').update({ tier }).eq('id', lead.id).select().single()
    if (data) onUpdate(data as Lead)
  }

  async function toggleLabel(labelId: string) {
    const existing = assignments.find(a => a.label_id === labelId)
    if (existing) {
      await supabase.from('lead_label_assignments').delete().eq('id', existing.id)
      onAssignmentsChanged(assignments.filter(a => a.id !== existing.id))
    } else {
      const { data } = await supabase.from('lead_label_assignments')
        .insert({ lead_id: lead.id, label_id: labelId }).select().single()
      if (data) onAssignmentsChanged([...assignments, data as LeadLabelAssignment])
    }
  }

  const stageBadge = STAGE_BADGE[lead.stage]
  const setter = setters.find(s => s.id === lead.setter_id)

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[1px]" onClick={onClose} />

      {/* Drawer */}
      <div className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-sm bg-white dark:bg-slate-900 shadow-2xl flex flex-col">

        {/* ── Header ── */}
        <div className="px-5 pt-5 pb-4 border-b border-gray-100 dark:border-slate-700">
          {/* Close + username row */}
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-bold text-gray-900 dark:text-slate-100 truncate">
                @{lead.ig_username}
              </h2>
              {lead.full_name && (
                <p className="text-sm text-gray-500 dark:text-slate-400 truncate">{lead.full_name}</p>
              )}
            </div>
            <button
              onClick={onClose}
              className="ml-3 mt-0.5 p-1.5 rounded-lg text-gray-400 dark:text-slate-500 hover:bg-gray-100 dark:hover:bg-slate-800 hover:text-gray-600 dark:hover:text-slate-300 transition-colors flex-shrink-0"
            >
              <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>

          {/* Stage badge */}
          <div className="flex items-center gap-2 flex-wrap mb-3">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${stageBadge.bg} ${stageBadge.text}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${stageBadge.dot}`} />
              {STAGE_LABELS[lead.stage]}
            </span>
            {lead.tier && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300 rounded-full text-xs font-semibold">
                <svg viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3">
                  <path d="M7.354 1.01a.75.75 0 01.292 0l1.96 3.97 4.38.637a.75.75 0 01.416 1.28L11.23 9.81l.75 4.38a.75.75 0 01-1.088.79L8 13.02l-2.892 1.96a.75.75 0 01-1.088-.79l.75-4.38-3.172-3.09a.75.75 0 01.416-1.28l4.38-.637 1.96-3.97z" />
                </svg>
                T{lead.tier}
              </span>
            )}
          </div>

          {/* Labels */}
          {labels.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {labels.map(l => {
                const active = assignments.some(a => a.label_id === l.id)
                return (
                  <button
                    key={l.id}
                    onClick={() => toggleLabel(l.id)}
                    className="px-2.5 py-1 rounded-full text-xs font-medium transition-all border"
                    style={
                      active
                        ? { background: l.bg_color, color: l.text_color, borderColor: l.text_color + '66' }
                        : { background: 'transparent', color: '#9ca3af', borderColor: '#e5e7eb' }
                    }
                  >
                    {active ? '● ' : '+ '}{l.name}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* ── Quick meta row ── */}
        <div className="flex items-center gap-4 px-5 py-2.5 bg-gray-50 dark:bg-slate-800/50 border-b border-gray-100 dark:border-slate-700 text-xs text-gray-500 dark:text-slate-500">
          <span>Added {formatDate(lead.created_at)}</span>
          {setter && <span>· {setter.name}</span>}
          {lead.call_booked_at && <span>· Call {formatDate(lead.call_booked_at)}</span>}
          {lead.call_closed && <span className="text-green-600 dark:text-green-400 font-semibold">· Closed ✓</span>}
        </div>

        {/* ── Tabs ── */}
        <div className="flex border-b border-gray-100 dark:border-slate-700 bg-white dark:bg-slate-900">
          {(['info', 'timeline'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-3 text-sm font-medium transition-colors relative ${
                activeTab === tab
                  ? 'text-blue-600 dark:text-blue-400'
                  : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-300'
              }`}
            >
              {tab === 'info' ? 'Info' : `Timeline${history.length > 0 ? ` (${history.length})` : ''}`}
              {activeTab === tab && (
                <span className="absolute bottom-0 left-1/4 right-1/4 h-0.5 bg-blue-600 dark:bg-blue-400 rounded-full" />
              )}
            </button>
          ))}
        </div>

        {/* ── Tab content ── */}
        <div className="flex-1 overflow-y-auto">

          {/* Info tab */}
          {activeTab === 'info' && (
            <div className="p-5 space-y-6">

              {/* Move stage */}
              <div>
                <p className="text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wide mb-2">Move to stage</p>
                <select
                  value={lead.stage}
                  onChange={e => onStageChange(e.target.value as LeadStage)}
                  className="w-full px-3 py-2.5 border border-gray-200 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {MOVEABLE_STAGES.map(s => (
                    <option key={s} value={s}>{STAGE_LABELS[s]}</option>
                  ))}
                </select>
              </div>

              {/* Tier */}
              <div>
                <p className="text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wide mb-2">Lead quality</p>
                <div className="flex gap-2">
                  {([1, 2, 3] as const).map(t => (
                    <button
                      key={t}
                      onClick={() => setTier(t)}
                      className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${
                        lead.tier === t
                          ? t === 1 ? 'bg-green-500 text-white' : t === 2 ? 'bg-yellow-400 text-white' : 'bg-gray-400 text-white'
                          : 'bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400 hover:bg-gray-200 dark:hover:bg-slate-700'
                      }`}
                    >
                      {t === 1 ? '🔥 Hot' : t === 2 ? '🌡 Warm' : '❄️ Cold'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Notes */}
              <div>
                <p className="text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wide mb-2">Notes</p>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  rows={5}
                  placeholder="Their goal, what they replied to, age, anything useful…"
                  className="w-full px-3 py-3 border border-gray-200 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
                <button
                  onClick={saveNotes}
                  disabled={saving || notes === lead.setter_notes}
                  className="mt-2 w-full py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-40 transition-colors"
                >
                  {saving ? 'Saving…' : 'Save notes'}
                </button>
              </div>

              {/* Call info (if any) */}
              {(lead.call_booked_at || lead.call_outcome) && (
                <div className="bg-gray-50 dark:bg-slate-800 rounded-xl p-4 space-y-2">
                  <p className="text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wide mb-3">Call details</p>
                  {lead.call_booked_at && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500 dark:text-slate-400">Booked</span>
                      <span className="font-medium text-gray-800 dark:text-slate-200">{formatDate(lead.call_booked_at)}</span>
                    </div>
                  )}
                  {lead.call_outcome && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500 dark:text-slate-400">Outcome</span>
                      <span className={`font-semibold capitalize ${lead.call_closed ? 'text-green-600 dark:text-green-400' : 'text-orange-600 dark:text-orange-400'}`}>
                        {lead.call_outcome.replace('_', ' ')}
                      </span>
                    </div>
                  )}
                  {lead.call_notes && (
                    <p className="text-xs text-gray-500 dark:text-slate-400 pt-1 border-t border-gray-200 dark:border-slate-700 mt-2">{lead.call_notes}</p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Timeline tab */}
          {activeTab === 'timeline' && (
            <div className="p-5">
              {historyLoading ? (
                <div className="text-center py-12">
                  <p className="text-xs text-gray-400 dark:text-slate-500">Loading timeline…</p>
                </div>
              ) : historyError ? (
                <div className="text-center py-12">
                  <p className="text-3xl mb-3">⚠️</p>
                  <p className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1">Couldn&apos;t load history</p>
                  <p className="text-xs text-gray-400 dark:text-slate-500">Check your connection and try again.</p>
                </div>
              ) : history.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-3xl mb-3">📋</p>
                  <p className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1">No activity yet</p>
                  <p className="text-xs text-gray-400 dark:text-slate-500">Actions like stage changes and notes will appear here.</p>
                </div>
              ) : (
                <div className="relative">
                  {/* Vertical line */}
                  <div className="absolute left-4 top-2 bottom-2 w-px bg-gray-100 dark:bg-slate-700" />

                  <div className="space-y-0">
                    {history.map((h, i) => {
                      const meta = historyMeta(h.action)
                      return (
                        <div key={h.id} className="relative flex gap-4 pb-5">
                          {/* Icon circle */}
                          <div className={`relative z-10 w-8 h-8 rounded-full ${meta.bg} ${meta.textColor} flex items-center justify-center flex-shrink-0`}>
                            {meta.icon}
                          </div>

                          {/* Content */}
                          <div className="flex-1 min-w-0 pt-1">
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-sm font-semibold text-gray-900 dark:text-slate-100 leading-tight">{h.action}</p>
                              <span className="text-[10px] text-gray-400 dark:text-slate-500 flex-shrink-0 mt-0.5">{timeAgo(h.created_at)}</span>
                            </div>
                            {h.actor && (
                              <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">{h.actor}</p>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
