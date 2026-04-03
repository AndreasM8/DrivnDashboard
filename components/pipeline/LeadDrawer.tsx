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
  userId: string
  onClose: () => void
  onUpdate: (updated: Lead) => void
  onStageChange: (stage: LeadStage) => void
  onAssignmentsChanged: (assignments: LeadLabelAssignment[]) => void
  onLabelAdded: (label: LeadLabel) => void
}

// ─── Preset label colours ─────────────────────────────────────────────────────

const LABEL_PRESETS: { bg: string; text: string; swatch: string }[] = [
  { bg: '#FECACA', text: '#991B1B', swatch: '#EF4444' },
  { bg: '#FED7AA', text: '#9A3412', swatch: '#F97316' },
  { bg: '#FEF08A', text: '#854D0E', swatch: '#EAB308' },
  { bg: '#BBF7D0', text: '#166534', swatch: '#22C55E' },
  { bg: '#99F6E4', text: '#0F766E', swatch: '#14B8A6' },
  { bg: '#BAE6FD', text: '#075985', swatch: '#0EA5E9' },
  { bg: '#DDD6FE', text: '#5B21B6', swatch: '#8B5CF6' },
  { bg: '#FBCFE8', text: '#9D174D', swatch: '#EC4899' },
  { bg: '#E5E7EB', text: '#374151', swatch: '#6B7280' },
]

const MOVEABLE_STAGES: LeadStage[] = ['follower', 'replied', 'freebie_sent', 'call_booked', 'closed', 'nurture', 'bad_fit', 'not_interested']

// ─── Stage badge config ───────────────────────────────────────────────────────

const STAGE_STYLE: Record<LeadStage, { background: string; color: string; dot: string }> = {
  follower:       { background: 'var(--surface-3)',           color: 'var(--text-2)',    dot: 'var(--border-strong)' },
  replied:        { background: 'rgba(37,99,235,0.1)',        color: 'var(--accent)',    dot: 'var(--accent)' },
  freebie_sent:   { background: 'rgba(139,92,246,0.1)',       color: 'var(--purple)',    dot: 'var(--purple)' },
  call_booked:    { background: 'rgba(245,158,11,0.1)',       color: 'var(--warning)',   dot: 'var(--warning)' },
  closed:         { background: 'rgba(22,163,74,0.1)',        color: 'var(--success)',   dot: 'var(--success)' },
  nurture:        { background: 'rgba(20,184,166,0.1)',       color: '#0D9488',          dot: '#0D9488' },
  bad_fit:        { background: 'rgba(220,38,38,0.08)',       color: 'var(--danger)',    dot: 'var(--danger)' },
  not_interested: { background: 'var(--surface-3)',           color: 'var(--text-3)',    dot: 'var(--border-strong)' },
}

// ─── Timeline icon helpers ─────────────────────────────────────────────────────

function historyMeta(action: string): { background: string; color: string; icon: React.ReactNode } {
  const a = action.toLowerCase()

  if (a.includes('added') || a.includes('created') || a.includes('pipeline')) {
    return {
      background: 'rgba(139,92,246,0.1)',
      color: 'var(--purple)',
      icon: (
        <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14">
          <path d="M10 9a3 3 0 100-6 3 3 0 000 6zM6 8a2 2 0 11-4 0 2 2 0 014 0zM1.49 15.326a.78.78 0 01-.358-.442 3 3 0 014.308-3.516 6.484 6.484 0 00-1.905 3.959c-.023.222-.014.442.025.654a4.97 4.97 0 01-2.07-.655zM16.44 15.98a4.97 4.97 0 002.07-.654.78.78 0 00.357-.442 3 3 0 00-4.308-3.517 6.484 6.484 0 011.907 3.96 2.32 2.32 0 01-.026.654zM18 8a2 2 0 11-4 0 2 2 0 014 0zM5.304 16.19a.844.844 0 01-.277-.71 5 5 0 019.947 0 .843.843 0 01-.277.71A6.975 6.975 0 0110 18a6.974 6.974 0 01-4.696-1.81z" />
        </svg>
      ),
    }
  }

  if (a.includes('moved') || a.includes('stage') || a.includes('→') || a.includes('->')) {
    return {
      background: 'rgba(37,99,235,0.1)',
      color: 'var(--accent)',
      icon: (
        <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14">
          <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
        </svg>
      ),
    }
  }

  if (a.includes('call') && (a.includes('book') || a.includes('sched'))) {
    return {
      background: 'rgba(245,158,11,0.1)',
      color: 'var(--warning)',
      icon: (
        <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14">
          <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
        </svg>
      ),
    }
  }

  if (a.includes('closed') || a.includes('won') || a.includes('outcome') || a.includes('showed')) {
    return {
      background: 'rgba(22,163,74,0.1)',
      color: 'var(--success)',
      icon: (
        <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14">
          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
        </svg>
      ),
    }
  }

  if (a.includes('no.show') || a.includes('no show') || a.includes('not interested') || a.includes('lost') || a.includes('bad fit')) {
    return {
      background: 'rgba(220,38,38,0.08)',
      color: 'var(--danger)',
      icon: (
        <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14">
          <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
      ),
    }
  }

  if (a.includes('label') || a.includes('tag')) {
    return {
      background: 'rgba(217,119,6,0.1)',
      color: 'var(--warning)',
      icon: (
        <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14">
          <path fillRule="evenodd" d="M17.707 9.293a1 1 0 010 1.414l-7 7a1 1 0 01-1.414 0l-7-7A.997.997 0 012 10V5a3 3 0 013-3h5c.256 0 .512.098.707.293l7 7zM5 6a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
        </svg>
      ),
    }
  }

  if (a.includes('tier')) {
    return {
      background: 'rgba(234,179,8,0.1)',
      color: '#CA8A04',
      icon: (
        <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ),
    }
  }

  if (a.includes('note')) {
    return {
      background: 'var(--surface-3)',
      color: 'var(--text-2)',
      icon: (
        <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14">
          <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
        </svg>
      ),
    }
  }

  if (a.includes('freebie') || a.includes('link') || a.includes('sent')) {
    return {
      background: 'rgba(99,102,241,0.1)',
      color: '#6366F1',
      icon: (
        <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14">
          <path fillRule="evenodd" d="M12.586 4.586a2 2 0 112.828 2.828l-3 3a2 2 0 01-2.828 0 1 1 0 00-1.414 1.414 4 4 0 005.656 0l3-3a4 4 0 00-5.656-5.656l-1.5 1.5a1 1 0 101.414 1.414l1.5-1.5zm-5 5a2 2 0 012.828 0 1 1 0 101.414-1.414 4 4 0 00-5.656 0l-3 3a4 4 0 105.656 5.656l1.5-1.5a1 1 0 10-1.414-1.414l-1.5 1.5a2 2 0 11-2.828-2.828l3-3z" clipRule="evenodd" />
        </svg>
      ),
    }
  }

  return {
    background: 'var(--surface-3)',
    color: 'var(--text-2)',
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14">
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

export default function LeadDrawer({ lead, labels, assignments, setters, userId, onClose, onUpdate, onStageChange, onAssignmentsChanged, onLabelAdded }: Props) {
  const [activeTab, setActiveTab] = useState<'info' | 'timeline'>('info')
  const [notes, setNotes] = useState(lead.setter_notes)
  const [history, setHistory] = useState<LeadHistory[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyError, setHistoryError] = useState(false)
  const [historyLimit, setHistoryLimit] = useState(10)
  const [saving, setSaving] = useState(false)

  const [showNewLabel, setShowNewLabel] = useState(false)
  const [newLabelName, setNewLabelName] = useState('')
  const [newLabelColor, setNewLabelColor] = useState(LABEL_PRESETS[6])
  const [creatingLabel, setCreatingLabel] = useState(false)

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
    const label = labels.find(l => l.id === labelId)
    const existing = assignments.find(a => a.label_id === labelId)

    if (existing) {
      await supabase.from('lead_label_assignments').delete().eq('id', existing.id)
      onAssignmentsChanged(assignments.filter(a => a.id !== existing.id))

      const { data: histEntry } = await supabase.from('lead_history').insert({
        lead_id: lead.id,
        action: `Label removed — ${label?.name ?? 'label'}`,
        actor: 'You',
      }).select().single()
      if (histEntry) setHistory(h => [histEntry as LeadHistory, ...h])
    } else {
      const { data } = await supabase.from('lead_label_assignments')
        .insert({ lead_id: lead.id, label_id: labelId }).select().single()
      if (data) onAssignmentsChanged([...assignments, data as LeadLabelAssignment])

      const { data: histEntry } = await supabase.from('lead_history').insert({
        lead_id: lead.id,
        action: `Label added — ${label?.name ?? 'label'}`,
        actor: 'You',
      }).select().single()
      if (histEntry) setHistory(h => [histEntry as LeadHistory, ...h])
    }
  }

  async function createLabel() {
    if (!newLabelName.trim()) return
    setCreatingLabel(true)
    const { data: label } = await supabase.from('lead_labels').insert({
      user_id: userId,
      name: newLabelName.trim(),
      bg_color: newLabelColor.bg,
      text_color: newLabelColor.text,
    }).select().single()

    if (label) {
      onLabelAdded(label as LeadLabel)
      const { data: assignment } = await supabase.from('lead_label_assignments')
        .insert({ lead_id: lead.id, label_id: label.id }).select().single()
      if (assignment) onAssignmentsChanged([...assignments, assignment as LeadLabelAssignment])

      const { data: histEntry } = await supabase.from('lead_history').insert({
        lead_id: lead.id,
        action: `Label added — ${label.name}`,
        actor: 'You',
      }).select().single()
      if (histEntry) setHistory(h => [histEntry as LeadHistory, ...h])
    }

    setNewLabelName('')
    setShowNewLabel(false)
    setCreatingLabel(false)
  }

  const stageStyle = STAGE_STYLE[lead.stage]
  const setter = setters.find(s => s.id === lead.setter_id)

  return (
    <>
      {/* Backdrop */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 40, background: 'rgba(0,0,0,0.3)' }} onClick={onClose} />

      {/* Drawer */}
      <div style={{ position: 'fixed', right: 0, top: 0, bottom: 0, zIndex: 50, width: '100%', maxWidth: 384, background: 'var(--surface-1)', boxShadow: 'var(--shadow-dropdown)', display: 'flex', flexDirection: 'column' }}>

        {/* Header */}
        <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid var(--border)' }}>
          <div className="flex items-start justify-between" style={{ marginBottom: 12 }}>
            <div className="flex-1 min-w-0">
              <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-1)', margin: 0 }} className="truncate">
                @{lead.ig_username}
              </h2>
              {lead.full_name && (
                <p style={{ fontSize: 14, color: 'var(--text-2)', margin: '2px 0 0', fontFamily: 'var(--font-mono)' }} className="truncate">{lead.full_name}</p>
              )}
            </div>
            <button
              onClick={onClose}
              style={{ color: 'var(--text-3)', background: 'none', border: 'none', cursor: 'pointer', padding: 4, lineHeight: 0, transition: 'color 120ms ease', marginLeft: 12, marginTop: 2 }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-1)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-3)')}
            >
              <svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>

          {/* Stage badge */}
          <div className="flex items-center gap-2 flex-wrap" style={{ marginBottom: 12 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 12px', borderRadius: 'var(--radius-badge)', fontSize: 12, fontWeight: 600, background: stageStyle.background, color: stageStyle.color }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: stageStyle.dot, flexShrink: 0 }} />
              {STAGE_LABELS[lead.stage]}
            </span>
            {lead.tier && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', background: 'rgba(234,179,8,0.1)', color: '#CA8A04', borderRadius: 'var(--radius-badge)', fontSize: 12, fontWeight: 600 }}>
                <svg viewBox="0 0 16 16" fill="currentColor" width="12" height="12">
                  <path d="M7.354 1.01a.75.75 0 01.292 0l1.96 3.97 4.38.637a.75.75 0 01.416 1.28L11.23 9.81l.75 4.38a.75.75 0 01-1.088.79L8 13.02l-2.892 1.96a.75.75 0 01-1.088-.79l.75-4.38-3.172-3.09a.75.75 0 01.416-1.28l4.38-.637 1.96-3.97z" />
                </svg>
                T{lead.tier}
              </span>
            )}
          </div>

          {/* Labels */}
          <div className="flex flex-wrap gap-1.5">
            {labels.map(l => {
              const active = assignments.some(a => a.label_id === l.id)
              return (
                <button
                  key={l.id}
                  onClick={() => toggleLabel(l.id)}
                  title={active ? `Remove "${l.name}"` : `Add "${l.name}"`}
                  style={
                    active
                      ? { background: l.bg_color, color: l.text_color, border: `1px solid ${l.text_color}44`, borderRadius: 'var(--radius-badge)', padding: '3px 10px', fontSize: 12, fontWeight: 500, cursor: 'pointer', transition: 'opacity 150ms' }
                      : { background: 'transparent', color: 'var(--text-3)', border: '1px solid var(--border)', borderRadius: 'var(--radius-badge)', padding: '3px 10px', fontSize: 12, fontWeight: 500, cursor: 'pointer', opacity: 0.6, transition: 'opacity 150ms' }
                  }
                >
                  {active ? '● ' : '○ '}{l.name}
                </button>
              )
            })}

            {!showNewLabel && (
              <button
                onClick={() => setShowNewLabel(true)}
                style={{ padding: '3px 10px', borderRadius: 'var(--radius-badge)', fontSize: 12, fontWeight: 500, color: 'var(--text-3)', background: 'transparent', border: '1px dashed var(--border)', cursor: 'pointer', transition: 'color 120ms, border-color 120ms' }}
                onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-2)'; e.currentTarget.style.borderColor = 'var(--border-strong)' }}
                onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-3)'; e.currentTarget.style.borderColor = 'var(--border)' }}
              >
                + New label
              </button>
            )}
          </div>

          {/* Inline new-label form */}
          {showNewLabel && (
            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8, padding: 12, background: 'var(--surface-2)', borderRadius: 'var(--radius-card)', border: '1px solid var(--border)' }}>
              <input
                autoFocus
                value={newLabelName}
                onChange={e => setNewLabelName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') createLabel(); if (e.key === 'Escape') setShowNewLabel(false) }}
                placeholder="Label name…"
                className="input-base"
              />
              <div className="flex items-center gap-1.5 flex-wrap">
                {LABEL_PRESETS.map(p => (
                  <button
                    key={p.swatch}
                    onClick={() => setNewLabelColor(p)}
                    style={{
                      width: 20, height: 20, borderRadius: '50%', border: `2px solid ${newLabelColor.swatch === p.swatch ? '#374151' : 'transparent'}`,
                      background: p.swatch, cursor: 'pointer', transition: 'transform 120ms',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.15)')}
                    onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
                  />
                ))}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={createLabel}
                  disabled={!newLabelName.trim() || creatingLabel}
                  className="btn-primary"
                  style={{ flex: 1, padding: '6px 0', fontSize: 12 }}
                >
                  {creatingLabel ? 'Creating…' : 'Create & apply'}
                </button>
                <button
                  onClick={() => { setShowNewLabel(false); setNewLabelName('') }}
                  style={{ padding: '6px 12px', fontSize: 12, color: 'var(--text-2)', background: 'none', border: 'none', cursor: 'pointer', borderRadius: 'var(--radius-btn)' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-3)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Quick meta row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '10px 20px', background: 'var(--surface-2)', borderBottom: '1px solid var(--border)', fontSize: 12, color: 'var(--text-3)' }}>
          <span>Added {formatDate(lead.created_at)}</span>
          {setter && <span>· {setter.name}</span>}
          {lead.call_booked_at && <span>· Call {formatDate(lead.call_booked_at)}</span>}
          {lead.call_closed && <span style={{ color: 'var(--success)', fontWeight: 600 }}>· Closed</span>}
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', background: 'var(--surface-1)' }}>
          {(['info', 'timeline'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                flex: 1, padding: '12px 0', fontSize: 14, fontWeight: 500, background: 'none', border: 'none', cursor: 'pointer',
                borderBottom: activeTab === tab ? '2px solid var(--accent)' : '2px solid transparent',
                color: activeTab === tab ? 'var(--accent)' : 'var(--text-2)',
                transition: 'color 120ms, border-color 120ms',
              }}
            >
              {tab === 'info' ? 'Info' : `Timeline${history.length > 0 ? ` (${history.length})` : ''}`}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto">

          {/* Info tab */}
          {activeTab === 'info' && (
            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 24 }}>

              {/* Move stage */}
              <div>
                <p className="label-caps" style={{ marginBottom: 8 }}>Move to stage</p>
                <select
                  value={lead.stage}
                  onChange={e => onStageChange(e.target.value as LeadStage)}
                  className="input-base"
                >
                  {MOVEABLE_STAGES.map(s => (
                    <option key={s} value={s}>{STAGE_LABELS[s]}</option>
                  ))}
                </select>
              </div>

              {/* Tier */}
              <div>
                <p className="label-caps" style={{ marginBottom: 8 }}>Lead quality</p>
                <div className="flex gap-2">
                  {([1, 2, 3] as const).map(t => (
                    <button
                      key={t}
                      onClick={() => setTier(t)}
                      style={{
                        flex: 1, padding: '10px 0', borderRadius: 'var(--radius-btn)', fontSize: 14, fontWeight: 700, border: 'none', cursor: 'pointer', transition: 'all 150ms',
                        background: lead.tier === t
                          ? t === 1 ? 'var(--success)' : t === 2 ? 'var(--warning)' : 'var(--border-strong)'
                          : 'var(--surface-3)',
                        color: lead.tier === t ? '#fff' : 'var(--text-2)',
                      }}
                    >
                      {t === 1 ? 'Hot' : t === 2 ? 'Warm' : 'Cold'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Notes */}
              <div>
                <p className="label-caps" style={{ marginBottom: 8 }}>Notes</p>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  rows={5}
                  placeholder="Their goal, what they replied to, age, anything useful…"
                  className="input-base"
                  style={{ resize: 'none' }}
                />
                <button
                  onClick={saveNotes}
                  disabled={saving || notes === lead.setter_notes}
                  className="btn-primary"
                  style={{ marginTop: 8, width: '100%', padding: '10px 0' }}
                >
                  {saving ? 'Saving…' : 'Save notes'}
                </button>
              </div>

              {/* Call info */}
              {(lead.call_booked_at || lead.call_outcome) && (
                <div style={{ background: 'var(--surface-2)', borderRadius: 'var(--radius-card)', padding: 16 }}>
                  <p className="label-caps" style={{ marginBottom: 12 }}>Call details</p>
                  {lead.call_booked_at && (
                    <div className="flex items-center justify-between" style={{ fontSize: 14, marginBottom: 8 }}>
                      <span style={{ color: 'var(--text-2)' }}>Booked</span>
                      <span style={{ fontWeight: 500, color: 'var(--text-1)' }}>{formatDate(lead.call_booked_at)}</span>
                    </div>
                  )}
                  {lead.call_outcome && (
                    <div className="flex items-center justify-between" style={{ fontSize: 14, marginBottom: lead.call_notes ? 8 : 0 }}>
                      <span style={{ color: 'var(--text-2)' }}>Outcome</span>
                      <span style={{ fontWeight: 600, textTransform: 'capitalize', color: lead.call_closed ? 'var(--success)' : 'var(--warning)' }}>
                        {lead.call_outcome.replace('_', ' ')}
                      </span>
                    </div>
                  )}
                  {lead.call_notes && (
                    <p style={{ fontSize: 12, color: 'var(--text-2)', paddingTop: 8, borderTop: '1px solid var(--border)', marginTop: 8 }}>{lead.call_notes}</p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Timeline tab */}
          {activeTab === 'timeline' && (
            <div style={{ padding: 20 }}>
              {historyLoading ? (
                <div style={{ textAlign: 'center', padding: '48px 0' }}>
                  <p style={{ fontSize: 12, color: 'var(--text-3)' }}>Loading timeline…</p>
                </div>
              ) : historyError ? (
                <div style={{ textAlign: 'center', padding: '48px 0' }}>
                  <p style={{ fontWeight: 600, color: 'var(--text-1)', marginBottom: 4 }}>Couldn&apos;t load history</p>
                  <p style={{ fontSize: 12, color: 'var(--text-3)' }}>Check your connection and try again.</p>
                </div>
              ) : history.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '48px 0' }}>
                  <p style={{ fontWeight: 600, color: 'var(--text-1)', marginBottom: 4 }}>No activity yet</p>
                  <p style={{ fontSize: 12, color: 'var(--text-3)' }}>Actions like stage changes and notes will appear here.</p>
                </div>
              ) : (
                <div style={{ position: 'relative' }}>
                  <div style={{ position: 'absolute', left: 16, top: 8, bottom: 8, width: 1, background: 'var(--border)' }} />
                  <div>
                    {history.slice(0, historyLimit).map((h) => {
                      const meta = historyMeta(h.action)
                      return (
                        <div key={h.id} style={{ position: 'relative', display: 'flex', gap: 16, paddingBottom: 20 }}>
                          <div style={{ position: 'relative', zIndex: 1, width: 32, height: 32, borderRadius: '50%', background: meta.background, color: meta.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            {meta.icon}
                          </div>
                          <div className="flex-1 min-w-0" style={{ paddingTop: 4 }}>
                            <div className="flex items-start justify-between gap-2">
                              <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-1)', lineHeight: 1.3, margin: 0 }}>{h.action}</p>
                              <span style={{ fontSize: 10, color: 'var(--text-3)', flexShrink: 0, marginTop: 2 }}>{timeAgo(h.created_at)}</span>
                            </div>
                            {h.actor && (
                              <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>{h.actor}</p>
                            )}
                          </div>
                        </div>
                      )
                    })}
                    {history.length > historyLimit && (
                      <button
                        onClick={() => setHistoryLimit(l => l + 10)}
                        style={{ width: '100%', marginTop: 8, padding: '8px 0', fontSize: 12, fontWeight: 500, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer' }}
                        onMouseEnter={e => (e.currentTarget.style.opacity = '0.7')}
                        onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
                      >
                        Show {Math.min(10, history.length - historyLimit)} more ({history.length - historyLimit} remaining)
                      </button>
                    )}
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
