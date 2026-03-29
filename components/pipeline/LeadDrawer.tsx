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

export default function LeadDrawer({ lead, labels, assignments, setters, onClose, onUpdate, onStageChange, onAssignmentsChanged }: Props) {
  const [notes, setNotes] = useState(lead.setter_notes)
  const [history, setHistory] = useState<LeadHistory[]>([])
  const [saving, setSaving] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    supabase.from('lead_history').select('*').eq('lead_id', lead.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => setHistory((data as LeadHistory[]) ?? []))
  }, [lead.id])

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

  function timeAgo(dateStr: string) {
    const d = Date.now() - new Date(dateStr).getTime()
    const m = Math.floor(d / 60000)
    if (m < 60) return `${m}m ago`
    const h = Math.floor(m / 60)
    if (h < 24) return `${h}h ago`
    return `${Math.floor(h / 24)}d ago`
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} />

      {/* Drawer */}
      <div className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-sm bg-white shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h2 className="font-bold text-gray-900">@{lead.ig_username}</h2>
            {lead.full_name && <p className="text-xs text-gray-400">{lead.full_name}</p>}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* Tier */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Tier</p>
            <div className="flex gap-2">
              {([1, 2, 3] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setTier(t)}
                  className={`w-10 h-10 rounded-xl text-sm font-bold transition-all ${
                    lead.tier === t ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Labels */}
          {labels.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Labels</p>
              <div className="flex flex-wrap gap-2">
                {labels.map(l => {
                  const active = assignments.some(a => a.label_id === l.id)
                  return (
                    <button
                      key={l.id}
                      onClick={() => toggleLabel(l.id)}
                      className="px-3 py-1 rounded-full text-xs font-medium transition-all border-2"
                      style={
                        active
                          ? { background: l.bg_color, color: l.text_color, borderColor: l.text_color }
                          : { background: 'transparent', color: '#6b7280', borderColor: '#e5e7eb' }
                      }
                    >
                      {l.name}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Move stage */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Move to stage</p>
            <select
              value={lead.stage}
              onChange={e => onStageChange(e.target.value as LeadStage)}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {MOVEABLE_STAGES.map(s => (
                <option key={s} value={s}>{STAGE_LABELS[s]}</option>
              ))}
            </select>
          </div>

          {/* Notes */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Notes</p>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={4}
              placeholder="Age, goal, source, anything useful…"
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
            <button
              onClick={saveNotes}
              disabled={saving || notes === lead.setter_notes}
              className="mt-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-40 transition-colors"
            >
              {saving ? 'Saving…' : 'Save notes'}
            </button>
          </div>

          {/* History */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">History</p>
            {history.length === 0 ? (
              <p className="text-xs text-gray-400">No activity yet.</p>
            ) : (
              <div className="space-y-2">
                {history.map(h => (
                  <div key={h.id} className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-gray-300 mt-1.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs text-gray-700">{h.action}</p>
                      <p className="text-[10px] text-gray-400">{h.actor} · {timeAgo(h.created_at)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
