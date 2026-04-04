'use client'

import { useState, useMemo, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { triggerSheetsSync } from '@/lib/sync-sheets-client'
import type { Lead, LeadLabel, LeadStage, LeadLabelAssignment, Setter, KpiTargets } from '@/types'
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
  kpiTargets: KpiTargets | null
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

// ─── Pipeline Funnel ──────────────────────────────────────────────────────────

function PipelineFunnel({ leads, kpiTargets }: { leads: Lead[]; kpiTargets: KpiTargets | null }) {
  const total = leads.length

  const repliedStages: LeadStage[]    = ['replied', 'freebie_sent', 'call_booked', 'nurture', 'bad_fit', 'not_interested', 'closed']
  const callBookedStages: LeadStage[] = ['call_booked', 'closed']

  const steps = [
    { label: 'LEADS',       count: total },
    { label: 'REPLIED',     count: leads.filter(l => repliedStages.includes(l.stage)).length },
    { label: 'BOOKED',      count: leads.filter(l => callBookedStages.includes(l.stage)).length },
    { label: 'CLOSED',      count: leads.filter(l => l.stage === 'closed').length },
  ]

  const convMeta: { target: number | null }[] = [
    { target: kpiTargets?.reply_rate_target   ?? null },
    { target: kpiTargets?.booking_rate_target ?? null },
    { target: kpiTargets?.close_rate_target   ?? null },
  ]

  if (total === 0) return null

  return (
    <div
      style={{
        margin: '16px 24px 8px',
        background: 'var(--surface-1)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-card)',
        boxShadow: 'var(--shadow-card)',
        padding: '20px 24px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
        {steps.map((step, i) => {
          const convRate = i < steps.length - 1 && step.count > 0
            ? Math.round((steps[i + 1].count / step.count) * 100)
            : null
          const target = convMeta[i]?.target ?? null

          let rateColor = 'var(--text-3)'
          if (convRate !== null && target !== null) {
            rateColor = convRate >= target ? '#16A34A'
              : convRate >= target * 0.8 ? '#D97706'
              : '#DC2626'
          } else if (convRate !== null) {
            rateColor = 'var(--accent)'
          }

          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
              {/* Stage block */}
              <div
                style={{
                  flex: 1,
                  background: 'var(--surface-2)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  padding: '12px 16px',
                  minWidth: 0,
                }}
              >
                <div
                  style={{
                    fontSize: '26px',
                    fontWeight: 600,
                    letterSpacing: '-0.03em',
                    color: 'var(--text-1)',
                    lineHeight: 1,
                    marginBottom: '4px',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {step.count}
                </div>
                <div className="label-caps">{step.label}</div>
              </div>

              {/* Arrow + conversion */}
              {i < steps.length - 1 && (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    padding: '0 8px',
                    flexShrink: 0,
                    gap: '2px',
                  }}
                >
                  <span style={{
                    fontSize: '9px',
                    fontWeight: 500,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    color: 'var(--text-3)',
                    whiteSpace: 'nowrap',
                    lineHeight: 1,
                  }}>
                    {(['Reply rate', 'Booking rate', 'Closing rate'] as const)[i]}
                  </span>
                  {convRate !== null && (
                    <span
                      style={{
                        fontSize: '13px',
                        fontWeight: 600,
                        color: rateColor,
                        fontVariantNumeric: 'tabular-nums',
                        lineHeight: 1,
                      }}
                    >
                      {convRate}%
                    </span>
                  )}
                  <svg width="20" height="12" viewBox="0 0 20 12" fill="none">
                    <path d="M0 6H16M16 6L11 1M16 6L11 11" stroke="var(--text-3)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Stage column config ──────────────────────────────────────────────────────

interface StageColumnConfig {
  stage: LeadStage
  label: string
  auto: boolean
  bg: string
  accent: string
  extraStages?: LeadStage[]
  hideable: boolean
  defaultHidden: boolean
  dotColor: string
}

const STAGE_COLUMNS: StageColumnConfig[] = [
  { stage: 'follower',       label: 'Followers',      auto: true,  bg: 'bg-white', accent: '#3B82F6',  extraStages: undefined,        hideable: false, defaultHidden: false, dotColor: '#3B82F6' },
  { stage: 'replied',        label: 'Replied',        auto: true,  bg: 'bg-white', accent: '#8B5CF6',  extraStages: ['freebie_sent'], hideable: false, defaultHidden: false, dotColor: '#8B5CF6' },
  { stage: 'call_booked',    label: 'Call booked',    auto: false, bg: 'bg-white', accent: '#F97316',  extraStages: undefined,        hideable: false, defaultHidden: false, dotColor: '#F97316' },
  { stage: 'closed',         label: 'Closed',         auto: false, bg: 'bg-white', accent: '#10B981',  extraStages: undefined,        hideable: false, defaultHidden: false, dotColor: '#10B981' },
  { stage: 'nurture',        label: 'Nurture',        auto: false, bg: 'bg-white', accent: '#F59E0B',  extraStages: undefined,        hideable: true,  defaultHidden: true,  dotColor: '#F59E0B' },
  { stage: 'not_interested', label: 'Not interested', auto: false, bg: 'bg-white', accent: '#94A3B8',  extraStages: undefined,        hideable: true,  defaultHidden: true,  dotColor: '#94A3B8' },
  { stage: 'bad_fit',        label: 'Bad fit',        auto: false, bg: 'bg-white', accent: '#FB7185',  extraStages: undefined,        hideable: true,  defaultHidden: true,  dotColor: '#FB7185' },
]

const DEFAULT_HIDDEN: LeadStage[] = ['nurture', 'not_interested', 'bad_fit']

function loadHiddenColumns(): Set<LeadStage> {
  if (typeof window === 'undefined') return new Set(DEFAULT_HIDDEN)
  try {
    const raw = localStorage.getItem('drivn_hidden_columns')
    if (raw) {
      const parsed = JSON.parse(raw) as LeadStage[]
      return new Set(parsed)
    }
  } catch {
    // ignore
  }
  return new Set(DEFAULT_HIDDEN)
}

// ─── Lead card ────────────────────────────────────────────────────────────────

const CONTACTED_STAGES: LeadStage[] = ['follower', 'replied', 'freebie_sent']

const TIER_META = {
  1: { label: 'T1', cssClass: 'tier-t1' },
  2: { label: 'T2', cssClass: 'tier-t2' },
  3: { label: 'T3', cssClass: 'tier-t3' },
} as const

function LeadCard({
  lead, labels, assignedLabelIds, onClick, onTierChange, onDragStart, onDragEnd, onContacted,
}: {
  lead: Lead
  labels: LeadLabel[]
  assignedLabelIds: string[]
  onClick: () => void
  onTierChange: (tier: 1 | 2 | 3) => void
  onDragStart: (e: React.DragEvent<HTMLDivElement>) => void
  onDragEnd: (e: React.DragEvent<HTMLDivElement>) => void
  onContacted: (leadId: string) => void
}) {
  const [contactedFlash, setContactedFlash] = useState(false)
  // Disable native HTML drag on touch devices — it blocks swipe-scroll and shows white ghost boxes
  const [isDraggable, setIsDraggable] = useState(false)
  useEffect(() => {
    setIsDraggable(!window.matchMedia('(hover: none)').matches)
  }, [])
  const days = daysSince(lead.last_contact_at)
  const assignedLabels = labels.filter(l => assignedLabelIds.includes(l.id))
  const showContactedBtn = CONTACTED_STAGES.includes(lead.stage)
  const tier = (lead.tier ?? 2) as 1 | 2 | 3
  const tierMeta = TIER_META[tier]

  // Pipedrive-style urgency dot
  const urgencyDot = days === null
    ? 'bg-gray-200 dark:bg-slate-600'
    : days >= 5 ? 'bg-red-500'
    : days >= 3 ? 'bg-amber-400'
    : 'bg-emerald-400'

  const urgencyTitle = days === null
    ? 'Never contacted'
    : days === 0 ? 'Contacted today'
    : `Last contact: ${days}d ago`

  async function handleContacted(e: React.MouseEvent) {
    e.stopPropagation()
    setContactedFlash(true)
    setTimeout(() => setContactedFlash(false), 1000)
    await fetch(`/api/leads/${lead.id}/contacted`, { method: 'PATCH' })
    onContacted(lead.id)
  }

  function handleTierCycle(e: React.MouseEvent) {
    e.stopPropagation()
    onTierChange(tier === 3 ? 1 : ((tier + 1) as 1 | 2 | 3))
  }

  return (
    <div
      draggable={isDraggable}
      onDragStart={isDraggable ? onDragStart : undefined}
      onDragEnd={isDraggable ? onDragEnd : undefined}
      onClick={onClick}
      style={{
        background: 'var(--surface-1)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-card)',
        padding: '10px 12px',
        cursor: 'pointer',
        transition: 'transform 120ms ease, box-shadow 120ms ease, border-color 120ms ease',
      }}
      onMouseEnter={e => {
        const el = e.currentTarget as HTMLDivElement
        el.style.transform = 'translateY(-2px)'
        el.style.boxShadow = 'var(--shadow-raised)'
        el.style.borderColor = 'var(--border-strong)'
        // Show tier buttons
        const tierBtns = el.querySelector('[data-tier-btns]') as HTMLElement | null
        if (tierBtns) tierBtns.style.opacity = '1'
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLDivElement
        el.style.transform = ''
        el.style.boxShadow = ''
        el.style.borderColor = 'var(--border)'
        const tierBtns = el.querySelector('[data-tier-btns]') as HTMLElement | null
        if (tierBtns) tierBtns.style.opacity = '0'
      }}
    >
      {/* Top row: username + timestamp + urgency dot */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '6px' }}>
        <p
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '12px',
            fontWeight: 600,
            color: 'var(--accent)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            flex: 1,
          }}
        >
          @{lead.ig_username}
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0 }}>
          {days !== null && (
            <span style={{ fontSize: '11px', color: 'var(--text-3)', fontVariantNumeric: 'tabular-nums' }}>
              {days === 0 ? 'today' : `${days}d`}
            </span>
          )}
          <div
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              flexShrink: 0,
              background:
                days === null ? 'var(--text-3)'
                : days >= 5 ? '#DC2626'
                : days >= 3 ? '#D97706'
                : '#16A34A',
            }}
            title={urgencyTitle}
          />
        </div>
      </div>

      {/* Note preview */}
      {lead.setter_notes && (
        <p style={{ fontSize: '11px', color: 'var(--text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: '8px', lineHeight: 1.4 }}>
          {lead.setter_notes}
        </p>
      )}

      {/* Bottom row: tier pill + labels + tier buttons on hover */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap', flex: 1 }}>
          <span className={`badge ${tierMeta.cssClass}`} style={{ cursor: 'pointer' }} onClick={handleTierCycle} title="Click to change tier">
            {tierMeta.label}
          </span>
          {assignedLabels.map(l => (
            <span
              key={l.id}
              className="badge"
              style={{ background: l.bg_color, color: l.text_color }}
            >
              {l.name}
            </span>
          ))}
        </div>

        {/* Tier selector — slides in on hover */}
        <div
          data-tier-btns=""
          style={{ display: 'flex', gap: '2px', opacity: 0, transition: 'opacity 100ms ease', flexShrink: 0 }}
          title="Change tier"
        >
          {([1, 2, 3] as const).map(t => (
            <button
              key={t}
              onClick={() => onTierChange(t)}
              style={{
                width: '20px',
                height: '20px',
                borderRadius: '4px',
                border: '1px solid var(--border-strong)',
                background: tier === t ? 'var(--accent)' : 'var(--surface-2)',
                color: tier === t ? '#fff' : 'var(--text-2)',
                fontSize: '10px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'background 80ms ease, color 80ms ease',
              }}
            >
              {t}
            </button>
          ))}
          {showContactedBtn && (
            <button
              onClick={handleContacted}
              title="Mark as contacted"
              style={{
                width: '20px',
                height: '20px',
                borderRadius: '4px',
                border: `1px solid ${contactedFlash ? '#16A34A' : 'var(--border-strong)'}`,
                background: contactedFlash ? '#16A34A' : 'var(--surface-2)',
                color: contactedFlash ? '#fff' : '#16A34A',
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'background 120ms ease',
              }}
            >
              ✓
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Stage column ─────────────────────────────────────────────────────────────

function StageColumn({
  stage, label, auto, bg, accent, leads, allLeadsInStage, labels, assignments, selectedLabels, tierFilter,
  onLeadClick, onTierChange, onAddClick, onDrop, onContacted, extraStages: _extraStages,
}: {
  stage: LeadStage
  label: string
  auto: boolean
  bg: string
  accent: string
  leads: Lead[]
  allLeadsInStage: Lead[]
  labels: LeadLabel[]
  assignments: LeadLabelAssignment[]
  selectedLabels: string[]
  tierFilter: TierFilter
  onLeadClick: (lead: Lead) => void
  onTierChange: (leadId: string, tier: 1 | 2 | 3) => void
  onAddClick: () => void
  onDrop: (leadId: string, targetStage: LeadStage) => void
  onContacted: (leadId: string) => void
  extraStages?: LeadStage[]
}) {
  const [isDragOver, setIsDragOver] = useState(false)

  const labelCountsInStage = useMemo(() => {
    return labels.map(l => ({
      label: l,
      count: allLeadsInStage.filter(lead =>
        assignments.some(a => a.lead_id === lead.id && a.label_id === l.id)
      ).length,
    })).filter(x => x.count > 0)
  }, [labels, allLeadsInStage, assignments])

  const tierBreakdown = useMemo(() => {
    const tiers: { tier: 1 | 2 | 3; cssClass: string }[] = [
      { tier: 1, cssClass: 'tier-t1' },
      { tier: 2, cssClass: 'tier-t2' },
      { tier: 3, cssClass: 'tier-t3' },
    ]
    return tiers.map(t => ({
      ...t,
      count: allLeadsInStage.filter(l => (l.tier ?? 2) === t.tier).length,
    })).filter(t => t.count > 0)
  }, [allLeadsInStage])

  function handleDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setIsDragOver(true)
  }

  function handleDragLeave(e: React.DragEvent<HTMLDivElement>) {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDragOver(false)
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setIsDragOver(false)
    const leadId = e.dataTransfer.getData('leadId')
    if (leadId) onDrop(leadId, stage)
  }

  const hasFilter = selectedLabels.length > 0

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={{
        flexShrink: 0,
        width: '256px',
        minWidth: '256px',
        background: isDragOver ? 'var(--surface-2)' : 'var(--surface-3)',
        border: isDragOver ? `1.5px dashed ${accent}` : '1px solid var(--border)',
        borderTop: `3px solid ${accent}`,
        borderRadius: 'var(--radius-card)',
        padding: '10px',
        display: 'flex',
        flexDirection: 'column',
        transition: 'background 120ms ease, border-color 120ms ease',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', padding: '0 2px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span className="section-title">{label}</span>
          <span
            className="badge"
            style={{
              background: hasFilter ? 'rgba(37,99,235,0.12)' : 'var(--surface-1)',
              color: hasFilter ? 'var(--accent)' : 'var(--text-2)',
              border: '1px solid var(--border)',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {hasFilter ? `${leads.length}/${allLeadsInStage.length}` : leads.length}
          </span>
          {auto && (
            <span
              className="badge"
              style={{ background: 'rgba(37,99,235,0.12)', color: 'var(--accent)' }}
            >
              AUTO
            </span>
          )}
        </div>
        <button
          onClick={onAddClick}
          style={{
            width: '24px',
            height: '24px',
            borderRadius: '6px',
            background: 'var(--surface-1)',
            border: '1px solid var(--border)',
            color: 'var(--text-2)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '16px',
            lineHeight: 1,
            fontWeight: 400,
            transition: 'background 120ms ease, color 120ms ease',
          }}
          onMouseEnter={e => {
            ;(e.currentTarget as HTMLButtonElement).style.background = 'var(--accent)'
            ;(e.currentTarget as HTMLButtonElement).style.color = '#fff'
          }}
          onMouseLeave={e => {
            ;(e.currentTarget as HTMLButtonElement).style.background = 'var(--surface-1)'
            ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--text-2)'
          }}
        >
          +
        </button>
      </div>

      {/* Tier + label chips */}
      {(tierBreakdown.length > 0 || labelCountsInStage.length > 0) && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '8px' }}>
          {tierBreakdown.map(({ tier, cssClass, count }) => {
            const isActive = tierFilter === String(tier)
            return (
              <span
                key={tier}
                className={`badge ${cssClass}`}
                style={{
                  opacity: tierFilter !== 'all' && !isActive ? 0.3 : 1,
                  outline: isActive ? '1.5px solid currentColor' : 'none',
                  outlineOffset: '1px',
                }}
              >
                T{tier} ({count})
              </span>
            )
          })}
          {labelCountsInStage.map(({ label: l, count }) => {
            const isActive = selectedLabels.includes(l.id)
            return (
              <span
                key={l.id}
                className="badge"
                style={{
                  background: l.bg_color,
                  color: l.text_color,
                  opacity: selectedLabels.length === 0 || isActive ? 1 : 0.3,
                  outline: isActive ? `1.5px solid ${l.text_color}` : 'none',
                  outlineOffset: '1px',
                }}
              >
                {l.name} {count}
              </span>
            )
          })}
        </div>
      )}

      {/* Cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', overflowY: 'auto', flex: 1, minHeight: 0, paddingBottom: '88px' }}>
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
              onContacted={onContacted}
              onDragStart={e => {
                e.dataTransfer.setData('leadId', lead.id)
                ;(e.currentTarget as HTMLDivElement).style.opacity = '0.4'
              }}
              onDragEnd={e => {
                ;(e.currentTarget as HTMLDivElement).style.opacity = '1'
              }}
            />
          )
        })}
        {leads.length === 0 && (
          <div style={{ textAlign: 'center', padding: '24px 8px', fontSize: '12px', color: 'var(--text-3)', lineHeight: 1.5 }}>
            {stage === 'follower' && 'Add a follower with +'}
            {stage === 'replied' && 'Move leads here when they reply'}
            {stage === 'call_booked' && 'Move leads here when a call is booked'}
            {stage === 'closed' && 'Move leads here when you close a deal'}
            {stage === 'nurture' && 'Leads to keep warm over time'}
            {stage === 'not_interested' && 'Leads who passed for now'}
            {stage === 'bad_fit' && 'Leads that are not a good fit'}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function PipelineClient({ initialLeads, labels: initialLabels, setters, assignments: initialAssignments, userId, kpiTargets }: Props) {
  const [leads, setLeads] = useState<Lead[]>(initialLeads)
  const [labels, setLabels] = useState<LeadLabel[]>(initialLabels)
  const [assignments, setAssignments] = useState<LeadLabelAssignment[]>(initialAssignments)

  const [tierFilter, setTierFilter] = useState<TierFilter>('all')
  const [selectedLabels, setSelectedLabels] = useState<string[]>([])
  const [search, setSearch] = useState('')

  const [hiddenColumns, setHiddenColumns] = useState<Set<LeadStage>>(loadHiddenColumns)
  const [showColumnToggles, setShowColumnToggles] = useState(false)

  function toggleColumn(stage: LeadStage) {
    setHiddenColumns(prev => {
      const next = new Set(prev)
      if (next.has(stage)) {
        next.delete(stage)
      } else {
        next.add(stage)
      }
      try {
        localStorage.setItem('drivn_hidden_columns', JSON.stringify([...next]))
      } catch {
        // ignore
      }
      return next
    })
  }

  const [addLeadOpen, setAddLeadOpen] = useState(false)
  const [addLeadStage, setAddLeadStage] = useState<LeadStage>('follower')
  const [drawerLead, setDrawerLead] = useState<Lead | null>(null)
  const [callBookedLead, setCallBookedLead] = useState<Lead | null>(null)
  const [callOutcomeLead, setCallOutcomeLead] = useState<Lead | null>(null)
  const [labelManagerOpen, setLabelManagerOpen] = useState(false)

  const supabase = createClient()

  // ─── Tier counts (unfiltered, across entire pipeline) ──────────────────────

  const tierCounts = useMemo(() => ({
    1: leads.filter(l => (l.tier ?? 2) === 1).length,
    2: leads.filter(l => (l.tier ?? 2) === 2).length,
    3: leads.filter(l => (l.tier ?? 2) === 3).length,
  }), [leads])

  // ─── Label counts (unfiltered, across entire pipeline) ─────────────────────

  const labelCounts = useMemo(() => {
    return labels.reduce<Record<string, number>>((acc, l) => {
      acc[l.id] = assignments.filter(a => a.label_id === l.id).length
      return acc
    }, {})
  }, [labels, assignments])

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
      if (selectedLabels.length > 0) {
        const hasAtLeastOne = selectedLabels.some(labelId =>
          assignments.some(a => a.lead_id === l.id && a.label_id === labelId)
        )
        if (!hasAtLeastOne) return false
      }
      if (search) {
        const q = search.toLowerCase()
        if (
          !l.ig_username.toLowerCase().includes(q) &&
          !l.full_name.toLowerCase().includes(q) &&
          !l.setter_notes.toLowerCase().includes(q)
        ) return false
      }
      return true
    })
  }, [leads, tierFilter, selectedLabels, search, assignments])

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
    setDrawerLead(d => d?.id === lead.id ? { ...d, stage } : d)
    const { error } = await supabase.from('leads').update({ stage, updated_at: new Date().toISOString() }).eq('id', lead.id)
    if (!error) {
      await supabase.from('lead_history').insert({
        lead_id: lead.id, action: `Stage moved to ${STAGE_LABELS[stage]}`, actor: 'You',
      })
      triggerSheetsSync()
    } else {
      // Revert optimistic update
      setLeads(ls => ls.map(l => l.id === lead.id ? lead : l))
      setDrawerLead(d => d?.id === lead.id ? lead : d)
    }
  }

  function handleDrop(leadId: string, targetStage: LeadStage) {
    const lead = leads.find(l => l.id === leadId)
    if (!lead) return
    if (lead.stage === targetStage) return
    if (targetStage === 'call_booked') {
      setCallBookedLead(lead)
      return
    }
    if (targetStage === 'closed') {
      setCallOutcomeLead(lead)
      return
    }
    moveStage(lead, targetStage)
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

  function handleContacted(leadId: string) {
    setLeads(ls => ls.map(l => l.id === leadId ? { ...l, last_contact_at: new Date().toISOString() } : l))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Top bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 24px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--surface-1)',
          flexShrink: 0,
        }}
      >
        <h1 className="page-title">Pipeline</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button className="btn-ghost" onClick={() => setLabelManagerOpen(true)}>Labels</button>
          <button
            className="btn-primary"
            onClick={() => { setAddLeadStage('follower'); setAddLeadOpen(true) }}
          >
            + Add follower
          </button>
        </div>
      </div>

      {/* Filter bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '10px 24px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--surface-1)',
          overflowX: 'auto',
          flexShrink: 0,
        }}
      >
        {(['all', '1', '2', '3'] as TierFilter[]).map(f => {
          const count = f === 'all' ? leads.length : tierCounts[f as unknown as 1 | 2 | 3]
          const isActive = tierFilter === f
          return (
            <button
              key={f}
              onClick={() => setTierFilter(f)}
              className="badge"
              style={{
                cursor: 'pointer',
                background: isActive ? 'rgba(37,99,235,0.1)' : 'var(--surface-2)',
                color: isActive ? 'var(--accent)' : 'var(--text-2)',
                border: `1px solid ${isActive ? 'rgba(37,99,235,0.3)' : 'var(--border)'}`,
                padding: '4px 10px',
                fontSize: '12px',
                whiteSpace: 'nowrap',
                transition: 'background 100ms ease, color 100ms ease',
              }}
            >
              {f === 'all' ? 'All' : `T${f}`}
              {' '}<span style={{ opacity: 0.6, fontVariantNumeric: 'tabular-nums' }}>({count})</span>
            </button>
          )
        })}

        {labels.length > 0 && (
          <>
            <div style={{ width: '1px', height: '16px', background: 'var(--border)', margin: '0 2px', flexShrink: 0 }} />
            {labels.map(l => {
              const isActive = selectedLabels.includes(l.id)
              const count = labelCounts[l.id] ?? 0
              return (
                <button
                  key={l.id}
                  onClick={() => setSelectedLabels(prev =>
                    isActive ? prev.filter(id => id !== l.id) : [...prev, l.id]
                  )}
                  className="badge"
                  style={{
                    cursor: 'pointer',
                    background: l.bg_color,
                    color: l.text_color,
                    opacity: selectedLabels.length === 0 || isActive ? 1 : 0.45,
                    outline: isActive ? `1.5px solid ${l.text_color}` : 'none',
                    outlineOffset: '1px',
                    padding: '4px 10px',
                    fontSize: '12px',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {l.name} <span style={{ opacity: 0.75 }}>({count})</span>
                </button>
              )
            })}
          </>
        )}

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
          {showColumnToggles && (
            <>
              {STAGE_COLUMNS.filter(c => c.hideable).map(col => {
                const visible = !hiddenColumns.has(col.stage)
                return (
                  <button
                    key={col.stage}
                    onClick={() => toggleColumn(col.stage)}
                    className="badge"
                    style={{
                      cursor: 'pointer',
                      background: visible ? 'var(--surface-3)' : 'var(--surface-2)',
                      color: visible ? 'var(--text-1)' : 'var(--text-3)',
                      border: '1px solid var(--border)',
                      padding: '4px 10px',
                      fontSize: '12px',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {col.label}
                  </button>
                )
              })}
              <div style={{ width: '1px', height: '16px', background: 'var(--border)', flexShrink: 0 }} />
            </>
          )}

          <button
            onClick={() => setShowColumnToggles(v => !v)}
            style={{
              padding: '6px',
              borderRadius: 'var(--radius-btn)',
              background: showColumnToggles ? 'rgba(37,99,235,0.1)' : 'transparent',
              border: 'none',
              color: showColumnToggles ? 'var(--accent)' : 'var(--text-3)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              transition: 'background 100ms ease',
            }}
            aria-label="Toggle column visibility"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </button>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search…"
            className="input-base"
            style={{ width: '160px' }}
          />
        </div>
      </div>

      {/* Conversion funnel */}
      <PipelineFunnel leads={filteredLeads} kpiTargets={kpiTargets} />

      {/* Kanban columns */}
      <div style={{ flex: 1, overflowX: 'auto', overflowY: 'hidden', WebkitOverflowScrolling: 'touch' }}>
        <div style={{ display: 'flex', gap: '12px', padding: '16px 24px', height: '100%', minWidth: 'max-content' }}>
          {STAGE_COLUMNS.filter(col => !hiddenColumns.has(col.stage)).map(col => {
            const inStage = (l: Lead) => l.stage === col.stage || (col.extraStages?.includes(l.stage) ?? false)
            return (
              <StageColumn
                key={col.stage}
                {...col}
                leads={filteredLeads.filter(inStage)}
                allLeadsInStage={leads.filter(inStage)}
                labels={labels}
                assignments={assignments}
                selectedLabels={selectedLabels}
                tierFilter={tierFilter}
                onLeadClick={setDrawerLead}
                onTierChange={updateTier}
                onContacted={handleContacted}
                onAddClick={() => { setAddLeadStage(col.stage); setAddLeadOpen(true) }}
                onDrop={handleDrop}
              />
            )
          })}
        </div>
      </div>

      {/* Modals */}
      {addLeadOpen && (
        <AddLeadModal
          userId={userId}
          defaultStage={addLeadStage}
          setters={setters}
          existingLeads={leads}
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
          userId={userId}
          onClose={() => setDrawerLead(null)}
          onUpdate={onLeadUpdated}
          onStageChange={stage => moveStage(drawerLead, stage)}
          onAssignmentsChanged={as => onAssignmentsChanged(drawerLead.id, as)}
          onLabelAdded={onLabelAdded}
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
