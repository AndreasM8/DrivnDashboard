'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
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
  const mainLightRef = useRef<SVGPathElement>(null)
  const mainDarkRef  = useRef<SVGPathElement>(null)
  const hlLightRef   = useRef<SVGPathElement>(null)
  const hlDarkRef    = useRef<SVGPathElement>(null)
  const prevPathRef  = useRef<string | null>(null)

  const total = leads.length

  const repliedStages: LeadStage[]    = ['replied', 'freebie_sent', 'call_booked', 'nurture', 'bad_fit', 'not_interested', 'closed']
  const callBookedStages: LeadStage[] = ['call_booked', 'closed']

  const steps = [
    { label: 'Leads',       count: total },
    { label: 'Replied',     count: leads.filter(l => repliedStages.includes(l.stage)).length },
    { label: 'Call booked', count: leads.filter(l => callBookedStages.includes(l.stage)).length },
    { label: 'Closed',      count: leads.filter(l => l.stage === 'closed').length },
  ]

  const W      = 600
  const H      = 120
  const cy     = H / 2
  const n      = steps.length
  const segW   = W / n
  const MIN_H  = H * 0.02   // ultra-thin floor — makes drop-offs extremely dramatic
  const MAX_H  = H * 0.92

  function barH(count: number) {
    if (total === 0) return MIN_H
    return Math.max(MIN_H, (count / total) * MAX_H)
  }

  // Height at each stage boundary (repeat last so shape closes)
  const hs = [...steps.map(s => barH(s.count)), barH(steps[n - 1].count)]

  // Smootherstep (Ken Perlin) — steeper shoulders, flatter middle than plain smoothstep
  function smootherstep(t: number): number {
    return t * t * t * (t * (t * 6 - 15) + 10)
  }

  function heightAt(x: number): number {
    const seg = Math.min(Math.floor(x / segW), n - 1)
    const t   = (x - seg * segW) / segW
    return hs[seg] * (1 - smootherstep(t)) + hs[seg + 1] * smootherstep(t)
  }

  const SAMPLES = 120
  const FREQ    = 3.2 * Math.PI * 2  // more wave cycles across the width
  const AMP     = 7                   // more pronounced waves

  function buildPath(): string {
    const top: string[] = []
    const bot: string[] = []

    for (let i = 0; i <= SAMPLES; i++) {
      const x    = (i / SAMPLES) * W
      const h    = heightAt(x)
      const amp  = AMP * Math.pow(h / MAX_H, 0.6)  // even thin sections get a little wave
      const wave = Math.sin((x / W) * FREQ + 0.4) * amp
      top.push(`${x.toFixed(1)},${(cy - h / 2 + wave).toFixed(2)}`)
      bot.push(`${x.toFixed(1)},${(cy + h / 2 - wave).toFixed(2)}`)
    }

    const topPath = `M ${top[0]} ` + top.slice(1).map(p => `L ${p}`).join(' ')
    const botPath = bot.slice().reverse().map(p => `L ${p}`).join(' ')
    return `${topPath} ${botPath} Z`
  }

  const pathD = useMemo(buildPath, [total, ...steps.map(s => s.count)])

  // Animate the path morph using Web Animations API whenever counts change
  useEffect(() => {
    const prev = prevPathRef.current
    if (!prev || prev === pathD) {
      prevPathRef.current = pathD
      return
    }
    const refs = [mainLightRef, mainDarkRef, hlLightRef, hlDarkRef]
    refs.forEach(r => {
      if (!r.current) return
      r.current.animate(
        [{ d: `path("${prev}")` }, { d: `path("${pathD}")` }],
        { duration: 700, easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)', fill: 'forwards' },
      )
    })
    prevPathRef.current = pathD
  }, [pathD])

  if (total === 0) return null

  // Map each funnel step's conversion to its KPI target field + label
  const convMeta: { target: number | null; label: string }[] = [
    { target: kpiTargets?.reply_rate_target   ?? null, label: 'Reply rate' },
    { target: kpiTargets?.booking_rate_target ?? null, label: 'Booking rate' },
    { target: kpiTargets?.close_rate_target   ?? null, label: 'Close rate' },
  ]

  const segs = steps.map((s, i) => ({
    ...s,
    convRate:   i < n - 1 && s.count > 0 ? Math.round((steps[i + 1].count / s.count) * 100) : null,
    convTarget: convMeta[i]?.target ?? null,
    convLabel:  convMeta[i]?.label  ?? '',
  }))

  return (
    <div className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl px-5 pt-4 pb-2 mx-6 mt-4 mb-2">

      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="w-full"
        style={{ height: 120, display: 'block' }}
      >
        <defs>
          <linearGradient id="fgLight" x1="0" y1="0" x2={W} y2="0" gradientUnits="userSpaceOnUse">
            <stop offset="0%"   stopColor="#818cf8" stopOpacity="1"    />
            <stop offset="33%"  stopColor="#38bdf8" stopOpacity="0.95" />
            <stop offset="66%"  stopColor="#fb923c" stopOpacity="0.90" />
            <stop offset="100%" stopColor="#34d399" stopOpacity="1"    />
          </linearGradient>
          <linearGradient id="fgDark" x1="0" y1="0" x2={W} y2="0" gradientUnits="userSpaceOnUse">
            <stop offset="0%"   stopColor="#6366f1" stopOpacity="0.90" />
            <stop offset="33%"  stopColor="#0ea5e9" stopOpacity="0.85" />
            <stop offset="66%"  stopColor="#f97316" stopOpacity="0.80" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0.90" />
          </linearGradient>
          <linearGradient id="hlLight" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="white" stopOpacity="0.32" />
            <stop offset="60%"  stopColor="white" stopOpacity="0.05" />
            <stop offset="100%" stopColor="white" stopOpacity="0"    />
          </linearGradient>
          <linearGradient id="hlDark" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="white" stopOpacity="0.14" />
            <stop offset="100%" stopColor="white" stopOpacity="0"    />
          </linearGradient>
          <filter id="funnelGlow" x="-5%" y="-20%" width="110%" height="140%">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        <path ref={mainLightRef} d={pathD} fill="url(#fgLight)" filter="url(#funnelGlow)" className="dark:opacity-0 transition-opacity" />
        <path ref={mainDarkRef}  d={pathD} fill="url(#fgDark)"  filter="url(#funnelGlow)" className="opacity-0 dark:opacity-100 transition-opacity" />
        <path ref={hlLightRef}   d={pathD} fill="url(#hlLight)" className="dark:opacity-0 transition-opacity" />
        <path ref={hlDarkRef}    d={pathD} fill="url(#hlDark)"  className="opacity-0 dark:opacity-100 transition-opacity" />

        {/* Stage dividers */}
        {Array.from({ length: n - 1 }, (_, i) => {
          const x = (i + 1) * segW
          const h = heightAt(x)
          return (
            <line key={i}
              x1={x} y1={cy - h / 2 + 2}
              x2={x} y2={cy + h / 2 - 2}
              stroke="white" strokeOpacity="0.5" strokeWidth="1.5"
            />
          )
        })}
      </svg>

      {/* Counts + labels */}
      <div className="flex mt-2">
        {segs.map((seg, i) => (
          <div key={i} className="flex-1 text-center min-w-0 px-1">
            <p className="text-sm font-bold text-gray-800 dark:text-slate-100 tabular-nums">{seg.count}</p>
            <p className="text-[10px] text-gray-400 dark:text-slate-500 font-medium truncate">{seg.label}</p>
          </div>
        ))}
      </div>

      {/* Conversion rates */}
      <div className="relative h-11 mt-0.5">
        {segs.slice(0, -1).map((seg, i) => {
          if (seg.convRate === null) return null
          const r = seg.convRate
          const t = seg.convTarget

          // Color relative to KPI target if set, otherwise neutral thresholds
          let color: string
          let dot: string
          let tooltip: string
          if (t !== null) {
            if (r >= t) {
              color = 'text-emerald-500 dark:text-emerald-400'
              dot   = 'bg-emerald-400'
              tooltip = `Target: ${t}% ✓`
            } else if (r >= t * 0.8) {
              color = 'text-amber-500 dark:text-amber-400'
              dot   = 'bg-amber-400'
              tooltip = `Target: ${t}% (${t - r}% below)`
            } else {
              color = 'text-rose-500 dark:text-rose-400'
              dot   = 'bg-rose-400'
              tooltip = `Target: ${t}% (${t - r}% below)`
            }
          } else {
            // No target set — neutral grey with a subtle hint to add one
            color   = 'text-gray-400 dark:text-slate-500'
            dot     = 'bg-gray-300 dark:bg-slate-600'
            tooltip = 'Set a target in Settings → Conversion targets'
          }

          return (
            <div key={i} className="absolute -translate-x-1/2 flex flex-col items-center gap-0.5"
              style={{ left: `${((i + 1) / n) * 100}%` }}
              title={tooltip}>
              <span className="text-[9px] text-gray-400 dark:text-slate-500 font-medium leading-none mb-0.5">{seg.convLabel}</span>
              <div className={`w-1 h-1 rounded-full ${dot} opacity-70`} />
              <span className={`text-xs font-bold tabular-nums leading-none ${color}`}>{r}%</span>
              {t !== null && (
                <span className="text-[9px] text-gray-300 dark:text-slate-600 leading-none tabular-nums">{t}%</span>
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
  { stage: 'follower',       label: 'Followers',      auto: true,  bg: 'bg-white dark:bg-slate-800',       accent: 'bg-blue-500',    extraStages: undefined,       hideable: false, defaultHidden: false, dotColor: 'bg-blue-400' },
  { stage: 'replied',        label: 'Replied',        auto: true,  bg: 'bg-white dark:bg-slate-800',       accent: 'bg-violet-500',  extraStages: ['freebie_sent'], hideable: false, defaultHidden: false, dotColor: 'bg-violet-400' },
  { stage: 'call_booked',    label: 'Call booked',    auto: false, bg: 'bg-white dark:bg-slate-800',       accent: 'bg-orange-500',  extraStages: undefined,        hideable: false, defaultHidden: false, dotColor: 'bg-orange-400' },
  { stage: 'closed',         label: 'Closed',         auto: false, bg: 'bg-white dark:bg-slate-800',       accent: 'bg-emerald-500', extraStages: undefined,        hideable: false, defaultHidden: false, dotColor: 'bg-emerald-400' },
  { stage: 'nurture',        label: 'Nurture',        auto: false, bg: 'bg-white dark:bg-slate-800',       accent: 'bg-amber-400',   extraStages: undefined,        hideable: true,  defaultHidden: true,  dotColor: 'bg-amber-400' },
  { stage: 'not_interested', label: 'Not interested', auto: false, bg: 'bg-white dark:bg-slate-800',       accent: 'bg-slate-400',   extraStages: undefined,        hideable: true,  defaultHidden: true,  dotColor: 'bg-slate-400' },
  { stage: 'bad_fit',        label: 'Bad fit',        auto: false, bg: 'bg-white dark:bg-slate-800',       accent: 'bg-rose-400',    extraStages: undefined,        hideable: true,  defaultHidden: true,  dotColor: 'bg-rose-400' },
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
  1: { label: 'T1', emoji: '🔥', bg: 'bg-red-50 dark:bg-red-900/20',    text: 'text-red-600 dark:text-red-400' },
  2: { label: 'T2', emoji: '💪', bg: 'bg-amber-50 dark:bg-amber-900/20', text: 'text-amber-600 dark:text-amber-400' },
  3: { label: 'T3', emoji: '🌱', bg: 'bg-gray-100 dark:bg-slate-700',    text: 'text-gray-500 dark:text-slate-400' },
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
      draggable={true}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onClick}
      className="relative bg-white dark:bg-slate-750 rounded-xl border border-gray-100 dark:border-slate-700 p-3 cursor-pointer hover:shadow-md hover:border-gray-200 dark:hover:border-slate-600 transition-all group shadow-sm"
    >
      {/* Top row: username + urgency dot */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <p className="font-semibold text-gray-900 dark:text-slate-100 text-sm truncate leading-tight">
          @{lead.ig_username}
        </p>
        <div
          className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ring-2 ring-white dark:ring-slate-800 ${urgencyDot}`}
          title={urgencyTitle}
        />
      </div>

      {/* Labels */}
      {assignedLabels.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {assignedLabels.map(l => (
            <span
              key={l.id}
              className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold"
              style={{ background: l.bg_color, color: l.text_color }}
            >
              {l.name}
            </span>
          ))}
        </div>
      )}

      {lead.setter_notes && (
        <p className="text-[11px] text-gray-400 dark:text-slate-500 line-clamp-1 mb-2 leading-snug">{lead.setter_notes}</p>
      )}

      {/* Bottom row: tier badge + time ago + contacted btn */}
      <div className="flex items-center justify-between gap-2 mt-1" onClick={e => e.stopPropagation()}>
        <button
          onClick={handleTierCycle}
          title="Click to change tier"
          className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full transition-all hover:opacity-80 ${tierMeta.bg} ${tierMeta.text}`}
        >
          {tierMeta.emoji} {tierMeta.label}
        </button>

        <div className="flex items-center gap-1.5">
          {days !== null && (
            <span className="text-[10px] text-gray-400 dark:text-slate-500 tabular-nums">
              {days === 0 ? 'today' : `${days}d ago`}
            </span>
          )}
          {showContactedBtn && (
            <button
              onClick={handleContacted}
              title="Mark as contacted"
              className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold transition-all ${
                contactedFlash
                  ? 'bg-emerald-500 text-white'
                  : 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 opacity-0 group-hover:opacity-100'
              }`}
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
    const tiers: { tier: 1 | 2 | 3; icon: string; cls: string }[] = [
      { tier: 1, icon: '🔥', cls: 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400' },
      { tier: 2, icon: '💪', cls: 'bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400' },
      { tier: 3, icon: '🌱', cls: 'bg-gray-100 text-gray-500 dark:bg-slate-700 dark:text-slate-400' },
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
      className={`flex-shrink-0 w-64 min-w-[256px] rounded-2xl ${bg} border transition-all ${
        isDragOver
          ? 'ring-2 ring-blue-400 border-blue-300 shadow-lg'
          : 'border-gray-100 dark:border-slate-700 shadow-sm'
      } flex flex-col`}
    >
      {/* Colored accent bar */}
      <div className={`h-1 rounded-t-2xl ${accent} ${isDragOver ? 'opacity-100' : 'opacity-80'}`} />

      <div className="p-3 flex flex-col gap-2 flex-1">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm text-gray-800 dark:text-slate-100">{label}</span>
            <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full tabular-nums ${
              hasFilter
                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                : 'bg-gray-100 text-gray-500 dark:bg-slate-700 dark:text-slate-400'
            }`}>
              {hasFilter ? `${leads.length} / ${allLeadsInStage.length}` : leads.length}
            </span>
            {auto && (
              <span className="text-[9px] font-bold text-blue-500 dark:text-blue-400 uppercase tracking-wide">Auto</span>
            )}
          </div>
          <button
            onClick={onAddClick}
            className="w-6 h-6 rounded-full bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400 hover:bg-blue-100 hover:text-blue-600 dark:hover:bg-blue-900/30 dark:hover:text-blue-400 transition-all flex items-center justify-center text-sm font-bold leading-none"
          >
            +
          </button>
        </div>

        {/* Tier + label chips — compact single row */}
        {(tierBreakdown.length > 0 || labelCountsInStage.length > 0) && (
          <div className="flex flex-wrap gap-1">
            {tierBreakdown.map(({ tier, icon, cls, count }) => {
              const isActive = tierFilter === String(tier)
              return (
                <span key={tier} className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full transition-all ${cls} ${
                  tierFilter !== 'all' && !isActive ? 'opacity-25' : ''
                } ${isActive ? 'ring-1 ring-current' : ''}`}>
                  {icon} {count}
                </span>
              )
            })}
            {labelCountsInStage.map(({ label: l, count }) => {
              const isActive = selectedLabels.includes(l.id)
              return (
                <span key={l.id} className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full transition-all"
                  style={{
                    background: l.bg_color, color: l.text_color,
                    opacity: selectedLabels.length === 0 || isActive ? 1 : 0.25,
                    outline: isActive ? `1.5px solid ${l.text_color}` : 'none',
                    outlineOffset: '1px',
                  }}>
                  {l.name} {count}
                </span>
              )
            })}
          </div>
        )}

        {/* Cards */}
        <div className="flex flex-col gap-2 overflow-y-auto max-h-[calc(100vh-240px)]">
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
                  ;(e.currentTarget as HTMLDivElement).classList.add('opacity-50')
                }}
                onDragEnd={e => {
                  ;(e.currentTarget as HTMLDivElement).classList.remove('opacity-50')
                }}
              />
            )
          })}
          {leads.length === 0 && (
            <div className="text-center py-6 text-xs text-gray-400 dark:text-slate-500 px-2">
            {stage === 'follower' && 'Add one with + Add above'}
            {stage === 'replied' && 'Add one with + Add above'}
            {stage === 'call_booked' && 'Move leads here when a call is booked'}
            {stage === 'closed' && 'Move leads here when you close a deal'}
            {stage === 'nurture' && 'Leads to keep warm over time'}
            {stage === 'not_interested' && 'Leads who passed for now'}
            {stage === 'bad_fit' && 'Leads that are not a good fit'}
          </div>
        )}
        </div>
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
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-slate-700 bg-white dark:bg-slate-800">
        <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100">Pipeline</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setLabelManagerOpen(true)}
            className="px-3 py-1.5 text-sm text-gray-600 dark:text-slate-400 border border-gray-200 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
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
      <div className="flex items-center gap-2 px-6 py-3 border-b border-gray-50 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-x-auto">
        {(['all', '1', '2', '3'] as TierFilter[]).map(f => {
          const icons: Record<string, string> = { '1': '🔥', '2': '💪', '3': '🌱' }
          const count = f === 'all' ? leads.length : tierCounts[f as unknown as 1 | 2 | 3]
          return (
            <button
              key={f}
              onClick={() => setTierFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors flex items-center gap-1 ${
                tierFilter === f ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700' : 'text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700'
              }`}
            >
              {icons[f] && <span>{icons[f]}</span>}
              {f === 'all' ? 'All' : `Tier ${f}`}
              <span className="font-bold opacity-60">{count}</span>
            </button>
          )
        })}

        {labels.length > 0 && (
          <>
            <div className="w-px h-4 bg-gray-200 dark:bg-slate-600 mx-1" />

            {/* All pill — clears label filter */}
            <button
              onClick={() => setSelectedLabels([])}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                selectedLabels.length === 0
                  ? 'bg-gray-200 dark:bg-slate-600 text-gray-700 dark:text-slate-200'
                  : 'text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700'
              }`}
            >
              All
            </button>

            {labels.map(l => {
              const isActive = selectedLabels.includes(l.id)
              const count = labelCounts[l.id] ?? 0
              return (
                <button
                  key={l.id}
                  onClick={() => setSelectedLabels(prev =>
                    isActive ? prev.filter(id => id !== l.id) : [...prev, l.id]
                  )}
                  className="px-3 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap flex items-center gap-1"
                  style={
                    isActive
                      ? { background: l.bg_color, color: l.text_color, outline: `2px solid ${l.text_color}`, outlineOffset: '1px' }
                      : { background: l.bg_color, color: l.text_color, opacity: 0.55 }
                  }
                >
                  {l.name}
                  <span className="font-bold opacity-75">{count}</span>
                </button>
              )
            })}
          </>
        )}

        <div className="ml-auto flex items-center gap-2 flex-shrink-0">
          {/* Column visibility pills — appear to the left of the eye when active */}
          {showColumnToggles && (
            <>
              {STAGE_COLUMNS.filter(c => c.hideable).map(col => {
                const visible = !hiddenColumns.has(col.stage)
                return (
                  <button
                    key={col.stage}
                    onClick={() => toggleColumn(col.stage)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                      visible
                        ? 'bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-200'
                        : 'text-gray-400 dark:text-slate-500 hover:bg-gray-100 dark:hover:bg-slate-700'
                    }`}
                  >
                    {col.label}
                  </button>
                )
              })}
              <div className="w-px h-4 bg-gray-200 dark:bg-slate-600 flex-shrink-0" />
            </>
          )}

          {/* Eye toggle */}
          <button
            onClick={() => setShowColumnToggles(v => !v)}
            className={`p-1.5 rounded-lg transition-colors ${
              showColumnToggles
                ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30'
                : 'text-gray-400 dark:text-slate-500 hover:bg-gray-100 dark:hover:bg-slate-700'
            }`}
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
            placeholder="Search followers…"
            className="px-3 py-1.5 border border-gray-200 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-44"
          />
        </div>
      </div>

      {/* Conversion funnel */}
      <PipelineFunnel leads={filteredLeads} kpiTargets={kpiTargets} />

      {/* Kanban columns */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden">
        <div className="flex gap-4 p-6 h-full min-w-max">
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
