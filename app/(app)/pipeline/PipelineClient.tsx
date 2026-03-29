'use client'

import { useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase'
import type { Lead, LeadLabel, LeadStage, LeadLabelAssignment, Setter } from '@/types'
import { STAGE_LABELS } from '@/types'
import AddLeadModal from '@/components/modals/AddLeadModal'
import LeadDrawer from '@/components/pipeline/LeadDrawer'
import CallBookedModal from '@/components/modals/CallBookedModal'
import CallOutcomeModal from '@/components/modals/CallOutcomeModal'
import LabelManager from '@/components/pipeline/LabelManager'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  initialLeads: Lead[]
  labels: LeadLabel[]
  setters: Setter[]
  assignments: LeadLabelAssignment[]
  userId: string
}

type TierFilter = 'all' | '1' | '2' | '3' | 'needs_followup'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function daysSince(dateStr: string | null) {
  if (!dateStr) return null
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000)
}

function contactColor(days: number | null) {
  if (days === null) return 'text-gray-400'
  if (days >= 5) return 'text-red-600'
  if (days >= 3) return 'text-amber-500'
  return 'text-green-600'
}

// ─── Stage column config ──────────────────────────────────────────────────────

const STAGE_COLUMNS: { stage: LeadStage; label: string; auto: boolean; bg: string }[] = [
  { stage: 'follower',     label: 'Follower',     auto: true,  bg: 'bg-blue-50'  },
  { stage: 'replied',      label: 'Replied',      auto: true,  bg: 'bg-blue-50'  },
  { stage: 'freebie_sent', label: 'Freebie sent', auto: false, bg: 'bg-white'    },
  { stage: 'call_booked',  label: 'Call booked',  auto: false, bg: 'bg-white'    },
  { stage: 'closed',       label: 'Closed',       auto: false, bg: 'bg-white'    },
]

// ─── Lead card ────────────────────────────────────────────────────────────────

function LeadCard({
  lead, labels, assignedLabelIds, onClick, onTierChange,
}: {
  lead: Lead
  labels: LeadLabel[]
  assignedLabelIds: string[]
  onClick: () => void
  onTierChange: (tier: 1 | 2 | 3) => void
}) {
  const days = daysSince(lead.last_contact_at)
  const assignedLabels = labels.filter(l => assignedLabelIds.includes(l.id))

  return (
    <div
      onClick={onClick}
      className="bg-white rounded-xl border border-gray-100 p-3 cursor-pointer hover:border-blue-200 hover:shadow-sm transition-all group"
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <p className="font-semibold text-gray-900 text-sm truncate">@{lead.ig_username}</p>
        {days !== null && (
          <span className={`text-xs font-medium flex-shrink-0 ${contactColor(days)}`}>
            {days === 0 ? 'today' : `${days}d`}
          </span>
        )}
      </div>

      {lead.setter_notes && (
        <p className="text-xs text-gray-500 line-clamp-2 mb-2">{lead.setter_notes}</p>
      )}

      {/* Labels */}
      {assignedLabels.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {assignedLabels.map(l => (
            <span
              key={l.id}
              className="text-xs px-2 py-0.5 rounded-full font-medium"
              style={{ background: l.bg_color, color: l.text_color }}
            >
              {l.name}
            </span>
          ))}
        </div>
      )}

      {/* Tier buttons */}
      <div className="flex gap-1" onClick={e => e.stopPropagation()}>
        {([1, 2, 3] as const).map(t => (
          <button
            key={t}
            onClick={() => onTierChange(t)}
            className={`w-7 h-7 rounded-lg text-xs font-semibold transition-all ${
              lead.tier === t
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}
          >
            {t}
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── Stage column ─────────────────────────────────────────────────────────────

function StageColumn({
  stage, label, auto, bg, leads, labels, assignments, onLeadClick, onTierChange, onAddClick,
}: {
  stage: LeadStage
  label: string
  auto: boolean
  bg: string
  leads: Lead[]
  labels: LeadLabel[]
  assignments: LeadLabelAssignment[]
  onLeadClick: (lead: Lead) => void
  onTierChange: (leadId: string, tier: 1 | 2 | 3) => void
  onAddClick: () => void
}) {
  return (
    <div className={`flex-shrink-0 w-64 rounded-xl p-3 ${bg} border border-gray-100 flex flex-col gap-2`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm text-gray-800">{label}</span>
          {auto && (
            <span className="text-[10px] font-bold text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded-full">AUTO</span>
          )}
          <span className="text-xs text-gray-400 font-medium">{leads.length}</span>
        </div>
        {!auto && (
          <button
            onClick={onAddClick}
            className="text-xs text-gray-400 hover:text-blue-600 transition-colors font-medium"
          >
            + Add
          </button>
        )}
      </div>

      {/* Auto note */}
      {auto && (
        <div className="text-[11px] text-blue-600 bg-blue-100 rounded-lg px-2.5 py-1.5 leading-tight">
          ManyChat adds leads here automatically.
        </div>
      )}

      {/* Cards */}
      <div className="flex flex-col gap-2 overflow-y-auto max-h-[calc(100vh-220px)]">
        {leads.map(lead => {
          const assignedLabelIds = assignments
            .filter(a => a.lead_id === lead.id)
            .map(a => a.label_id)
          return (
            <LeadCard
              key={lead.id}
              lead={lead}
              labels={labels}
              assignedLabelIds={assignedLabelIds}
              onClick={() => onLeadClick(lead)}
              onTierChange={tier => onTierChange(lead.id, tier)}
            />
          )
        })}
        {leads.length === 0 && (
          <div className="text-center py-6 text-xs text-gray-400">No leads here</div>
        )}
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function PipelineClient({ initialLeads, labels: initialLabels, setters, assignments: initialAssignments, userId }: Props) {
  const [leads, setLeads] = useState<Lead[]>(initialLeads)
  const [labels, setLabels] = useState<LeadLabel[]>(initialLabels)
  const [assignments, setAssignments] = useState<LeadLabelAssignment[]>(initialAssignments)

  const [tierFilter, setTierFilter] = useState<TierFilter>('all')
  const [labelFilter, setLabelFilter] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const [addLeadOpen, setAddLeadOpen] = useState(false)
  const [addLeadStage, setAddLeadStage] = useState<LeadStage>('follower')
  const [drawerLead, setDrawerLead] = useState<Lead | null>(null)
  const [callBookedLead, setCallBookedLead] = useState<Lead | null>(null)
  const [callOutcomeLead, setCallOutcomeLead] = useState<Lead | null>(null)
  const [labelManagerOpen, setLabelManagerOpen] = useState(false)

  const supabase = createClient()

  // ─── Filtering ─────────────────────────────────────────────────────────────

  const filteredLeads = useMemo(() => {
    return leads.filter(l => {
      if (tierFilter === '1' && l.tier !== 1) return false
      if (tierFilter === '2' && l.tier !== 2) return false
      if (tierFilter === '3' && l.tier !== 3) return false
      if (tierFilter === 'needs_followup') {
        const days = daysSince(l.last_contact_at)
        if (days === null || days < 3) return false
      }
      if (labelFilter) {
        const hasLabel = assignments.some(a => a.lead_id === l.id && a.label_id === labelFilter)
        if (!hasLabel) return false
      }
      if (search) {
        const q = search.toLowerCase()
        if (!l.ig_username.toLowerCase().includes(q) && !l.full_name.toLowerCase().includes(q)) return false
      }
      return true
    })
  }, [leads, tierFilter, labelFilter, search, assignments])

  // ─── Actions ───────────────────────────────────────────────────────────────

  async function updateTier(leadId: string, tier: 1 | 2 | 3) {
    setLeads(ls => ls.map(l => l.id === leadId ? { ...l, tier } : l))
    await supabase.from('leads').update({ tier }).eq('id', leadId)
  }

  async function moveStage(lead: Lead, stage: LeadStage) {
    // Special handling for call_booked and closed
    if (stage === 'call_booked') {
      setCallBookedLead({ ...lead, stage })
      return
    }
    if (stage === 'closed') {
      setCallOutcomeLead({ ...lead, stage })
      return
    }

    setLeads(ls => ls.map(l => l.id === lead.id ? { ...l, stage } : l))
    await supabase.from('leads').update({ stage, updated_at: new Date().toISOString() }).eq('id', lead.id)
    await supabase.from('lead_history').insert({
      lead_id: lead.id, action: `Stage moved to ${STAGE_LABELS[stage]}`, actor: 'You',
    })
  }

  function onLeadAdded(lead: Lead) {
    setLeads(ls => [lead, ...ls])
    setAddLeadOpen(false)
  }

  function onLeadUpdated(updated: Lead) {
    setLeads(ls => ls.map(l => l.id === updated.id ? updated : l))
    setDrawerLead(updated)
  }

  function onAssignmentsChanged(leadId: string, newAssignments: LeadLabelAssignment[]) {
    setAssignments(prev => [
      ...prev.filter(a => a.lead_id !== leadId),
      ...newAssignments,
    ])
  }

  function onLabelAdded(label: LeadLabel) {
    setLabels(ls => [...ls, label])
  }

  function onLabelRemoved(labelId: string) {
    setLabels(ls => ls.filter(l => l.id !== labelId))
    setAssignments(as => as.filter(a => a.label_id !== labelId))
  }

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-white">
        <h1 className="text-xl font-bold text-gray-900">Pipeline</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setLabelManagerOpen(true)}
            className="px-3 py-1.5 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Labels
          </button>
          <button
            onClick={() => { setAddLeadStage('follower'); setAddLeadOpen(true) }}
            className="px-4 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            + Add follower
          </button>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-2 px-6 py-3 border-b border-gray-50 bg-white overflow-x-auto">
        {(['all', '1', '2', '3', 'needs_followup'] as TierFilter[]).map(f => (
          <button
            key={f}
            onClick={() => setTierFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
              tierFilter === f ? 'bg-blue-100 text-blue-700' : 'text-gray-500 hover:bg-gray-100'
            }`}
          >
            {f === 'all' ? 'All' : f === 'needs_followup' ? 'Needs follow-up' : `Tier ${f}`}
          </button>
        ))}

        <div className="w-px h-4 bg-gray-200 mx-1" />

        {labels.map(l => (
          <button
            key={l.id}
            onClick={() => setLabelFilter(labelFilter === l.id ? null : l.id)}
            className="px-3 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap"
            style={
              labelFilter === l.id
                ? { background: l.bg_color, color: l.text_color, outline: `2px solid ${l.text_color}` }
                : { background: l.bg_color, color: l.text_color }
            }
          >
            {l.name}
          </button>
        ))}

        <div className="ml-auto">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search followers…"
            className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-44"
          />
        </div>
      </div>

      {/* Kanban columns */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden">
        <div className="flex gap-4 p-6 h-full min-w-max">
          {STAGE_COLUMNS.map(col => (
            <StageColumn
              key={col.stage}
              {...col}
              leads={filteredLeads.filter(l => l.stage === col.stage)}
              labels={labels}
              assignments={assignments}
              onLeadClick={setDrawerLead}
              onTierChange={updateTier}
              onAddClick={() => { setAddLeadStage(col.stage); setAddLeadOpen(true) }}
            />
          ))}
        </div>
      </div>

      {/* Modals */}
      {addLeadOpen && (
        <AddLeadModal
          userId={userId}
          defaultStage={addLeadStage}
          setters={setters}
          onClose={() => setAddLeadOpen(false)}
          onAdded={onLeadAdded}
        />
      )}

      {drawerLead && (
        <LeadDrawer
          lead={drawerLead}
          labels={labels}
          assignments={assignments.filter(a => a.lead_id === drawerLead.id)}
          setters={setters}
          onClose={() => setDrawerLead(null)}
          onUpdate={onLeadUpdated}
          onStageChange={stage => moveStage(drawerLead, stage)}
          onAssignmentsChanged={as => onAssignmentsChanged(drawerLead.id, as)}
        />
      )}

      {callBookedLead && (
        <CallBookedModal
          lead={callBookedLead}
          setters={setters.filter(s => s.role === 'closer' || s.role === 'both')}
          onClose={() => setCallBookedLead(null)}
          onSaved={updated => {
            setLeads(ls => ls.map(l => l.id === updated.id ? updated : l))
            if (drawerLead?.id === updated.id) setDrawerLead(updated)
            setCallBookedLead(null)
          }}
        />
      )}

      {callOutcomeLead && (
        <CallOutcomeModal
          lead={callOutcomeLead}
          userId={userId}
          onClose={() => setCallOutcomeLead(null)}
          onSaved={(updated, newClient) => {
            setLeads(ls => ls.map(l => l.id === updated.id ? updated : l))
            if (drawerLead?.id === updated.id) setDrawerLead(updated)
            setCallOutcomeLead(null)
            if (newClient) {
              // Client was created — could toast here
            }
          }}
        />
      )}

      {labelManagerOpen && (
        <LabelManager
          userId={userId}
          labels={labels}
          onClose={() => setLabelManagerOpen(false)}
          onAdded={onLabelAdded}
          onRemoved={onLabelRemoved}
        />
      )}
    </div>
  )
}
