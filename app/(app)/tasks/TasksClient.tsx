'use client'

import { useState, useMemo, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import type { Task, TaskType, TaskPriority, Lead, LeadStage } from '@/types'
import { TASK_TYPE_STYLES } from '@/types'
import AddTaskModal from '@/components/modals/AddTaskModal'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDueDate(dateStr: string) {
  const d = new Date(dateStr)
  const now = new Date()
  const diffMs = d.getTime() - now.getTime()
  const diffDays = Math.round(diffMs / 86400000)
  if (diffDays < -1) return `${Math.abs(diffDays)} days ago`
  if (diffDays === -1) return 'Yesterday'
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Tomorrow'
  return d.toLocaleDateString('en', { month: 'short', day: 'numeric' })
}

function daysSince(dateStr: string | null) {
  if (!dateStr) return null
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000)
}

const PRIORITY_LABELS: Record<TaskPriority, string> = {
  overdue:   'Overdue',
  today:     'Today',
  this_week: 'This week',
  upcoming:  'Coming up',
}

// Left border color per priority (upsell type overrides to purple in TaskRow)
const PRIORITY_BORDER: Record<TaskPriority, string> = {
  overdue:   'var(--danger)',
  today:     'var(--warning)',
  this_week: 'var(--border-strong)',
  upcoming:  'var(--border-strong)',
}

// Section count badge colors
const SECTION_BADGE_BG: Record<TaskPriority, string> = {
  overdue:   'rgba(220,38,38,0.1)',
  today:     'rgba(217,119,6,0.1)',
  this_week: 'var(--surface-3)',
  upcoming:  'var(--surface-3)',
}
const SECTION_BADGE_COLOR: Record<TaskPriority, string> = {
  overdue:   'var(--danger)',
  today:     'var(--warning)',
  this_week: 'var(--text-2)',
  upcoming:  'var(--text-2)',
}

const FILTER_TYPES: { key: 'all' | TaskType; label: string }[] = [
  { key: 'all',          label: 'All' },
  { key: 'follow_up',    label: 'Follow-ups' },
  { key: 'payment',      label: 'Payments' },
  { key: 'upsell',       label: 'Upsells' },
  { key: 'nurture',      label: 'Nurture' },
  { key: 'call_outcome', label: 'Calls' },
]

const PRIORITY_ORDER: TaskPriority[] = ['overdue', 'today', 'this_week', 'upcoming']

const STAGE_LABELS: Record<LeadStage, string> = {
  follower:       'Follower',
  replied:        'Replied',
  freebie_sent:   'Freebie sent',
  call_booked:    'Call booked',
  closed:         'Closed',
  nurture:        'Nurture',
  bad_fit:        'Bad fit',
  not_interested: 'Not interested',
}

const STAGE_PILL_STYLE: Record<LeadStage, { bg: string; color: string }> = {
  follower:       { bg: 'var(--surface-3)',          color: 'var(--text-2)' },
  replied:        { bg: 'rgba(37,99,235,0.1)',        color: 'var(--accent)' },
  freebie_sent:   { bg: 'rgba(124,58,237,0.1)',       color: 'var(--purple)' },
  call_booked:    { bg: 'rgba(217,119,6,0.12)',       color: 'var(--warning)' },
  closed:         { bg: 'rgba(22,163,74,0.12)',       color: 'var(--success)' },
  nurture:        { bg: 'rgba(20,184,166,0.12)',      color: '#0d9488' },
  bad_fit:        { bg: 'rgba(220,38,38,0.1)',        color: 'var(--danger)' },
  not_interested: { bg: 'var(--surface-3)',           color: 'var(--text-3)' },
}

// Tier labels — no emojis
const TIER_LABEL: Record<1 | 2 | 3, string> = { 1: 'T1', 2: 'T2', 3: 'T3' }
const TIER_CSS: Record<1 | 2 | 3, string>   = { 1: 'tier-t1', 2: 'tier-t2', 3: 'tier-t3' }

// ─── Daily digest banner ──────────────────────────────────────────────────────

const DIGEST_KEY = 'drivn_digest_date'

function DigestBanner({ tasks, watching, onDismiss }: { tasks: Task[]; watching: number; onDismiss: () => void }) {
  const overdue  = tasks.filter(t => t.priority === 'overdue').length
  const today    = tasks.filter(t => t.priority === 'today').length
  const hour     = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  const items: { text: string; color: string }[] = []
  if (overdue > 0)  items.push({ text: `${overdue} overdue task${overdue !== 1 ? 's' : ''}`,     color: 'var(--danger)' })
  if (today   > 0)  items.push({ text: `${today} due today`,                                       color: 'var(--warning)' })
  if (watching > 0) items.push({ text: `Watching ${watching} lead${watching !== 1 ? 's' : ''}`,   color: 'var(--accent)' })
  if (items.length === 0) items.push({ text: 'No open tasks — great work!', color: 'var(--success)' })

  return (
    <div
      style={{
        margin: '16px 24px 4px',
        padding: '12px 14px',
        borderRadius: 'var(--radius-card)',
        background: 'var(--surface-2)',
        border: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: '12px',
      }}
    >
      <div style={{ flex: 1 }}>
        <p style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-1)', marginBottom: '6px' }}>{greeting}</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
          {items.map((item, i) => (
            <p key={i} style={{ fontSize: '11px', fontWeight: '500', color: item.color, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: item.color, flexShrink: 0 }} />
              {item.text}
            </p>
          ))}
        </div>
      </div>
      <button
        onClick={onDismiss}
        style={{ color: 'var(--text-3)', background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0 }}
      >
        <svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14">
          <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L8 6.586l2.293-2.293a1 1 0 111.414 1.414L9.414 8l2.293 2.293a1 1 0 01-1.414 1.414L8 9.414l-2.293 2.293a1 1 0 01-1.414-1.414L6.586 8 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
      </button>
    </div>
  )
}

// ─── Task row ─────────────────────────────────────────────────────────────────

function TaskRow({ task, onComplete }: { task: Task; onComplete: (id: string) => void }) {
  const [fading, setFading] = useState(false)
  const [hover, setHover]   = useState(false)
  const style         = TASK_TYPE_STYLES[task.type]
  const isOverdue     = task.priority === 'overdue'
  const isUpsell      = task.type === 'upsell'
  const borderColor   = isUpsell ? 'var(--purple)' : PRIORITY_BORDER[task.priority]
  const usernameMatch = task.title.match(/@([\w.]+)/)
  const leadUsername  = usernameMatch ? usernameMatch[1] : null

  function handleCheck() {
    setFading(true)
    setTimeout(() => onComplete(task.id), 600)
  }

  return (
    <div
      className={fading ? 'task-fade-out' : ''}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '10px',
        padding: '10px 14px 10px 12px',
        borderRadius: 'var(--radius-card)',
        background: 'var(--surface-1)',
        border: '1px solid var(--border)',
        borderLeft: `3px solid ${borderColor}`,
        boxShadow: 'var(--shadow-card)',
      }}
    >
      {/* Circular checkbox */}
      <button
        onClick={handleCheck}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={{
          width: '18px',
          height: '18px',
          borderRadius: '50%',
          border: fading ? 'none' : `1.5px solid ${hover ? 'var(--success)' : 'var(--border-strong)'}`,
          background: fading ? 'var(--success)' : 'transparent',
          flexShrink: 0,
          marginTop: '1px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          transition: 'all 120ms ease',
          padding: 0,
        }}
      >
        {fading && (
          <svg viewBox="0 0 10 10" fill="none" width="10" height="10">
            <path
              d="M2 5l2.5 2.5 3.5-3.5"
              stroke="#fff"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="check-draw"
            />
          </svg>
        )}
      </button>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginBottom: '3px' }}>
          <p style={{ fontSize: '13px', fontWeight: '500', color: 'var(--text-1)', flex: '1 1 0', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {task.title}
          </p>
          <span
            className="badge"
            style={{ background: style.bg, color: style.text, fontSize: '10px', flexShrink: 0 }}
          >
            {style.label}
          </span>
          {task.lead_id && leadUsername && (
            <a
              href="/pipeline"
              onClick={e => e.stopPropagation()}
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '10px',
                fontWeight: '500',
                padding: '1px 6px',
                borderRadius: 'var(--radius-badge)',
                background: 'rgba(37,99,235,0.1)',
                color: 'var(--accent)',
                textDecoration: 'none',
                flexShrink: 0,
              }}
            >
              @{leadUsername}
            </a>
          )}
        </div>
        <p style={{ fontSize: '12px', color: 'var(--text-2)', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
          {task.description}
        </p>
      </div>

      {/* Right: reminder + due date */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0, marginTop: '1px' }}>
        {task.reminder_at && (
          <span title={`Reminder: ${formatDueDate(task.reminder_at)}`}>
            <svg viewBox="0 0 16 16" fill="currentColor" width="11" height="11" style={{ color: 'var(--accent)', opacity: 0.6 }}>
              <path d="M8 1a5 5 0 00-5 5v2.586l-.707.707A1 1 0 003 11h10a1 1 0 00.707-1.707L13 8.586V6a5 5 0 00-5-5zm0 13a1.5 1.5 0 01-1.5-1.5h3A1.5 1.5 0 018 14z" />
            </svg>
          </span>
        )}
        <span style={{ fontSize: '11px', color: isOverdue ? 'var(--danger)' : 'var(--text-3)', fontWeight: isOverdue ? '600' : '400' }}>
          {formatDueDate(task.due_at)}
        </span>
      </div>
    </div>
  )
}

// ─── Task section ─────────────────────────────────────────────────────────────

function TaskSection({ priority, tasks, onComplete }: { priority: TaskPriority; tasks: Task[]; onComplete: (id: string) => void }) {
  if (tasks.length === 0) return null
  return (
    <div>
      {/* Sticky section header */}
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          background: 'var(--bg-base)',
          paddingTop: '8px',
          paddingBottom: '8px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '6px',
        }}
      >
        <span className="label-caps">{PRIORITY_LABELS[priority]}</span>
        <span
          className="badge"
          style={{
            background: SECTION_BADGE_BG[priority],
            color: SECTION_BADGE_COLOR[priority],
          }}
        >
          {tasks.length}
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {tasks.map(t => <TaskRow key={t.id} task={t} onComplete={onComplete} />)}
      </div>
    </div>
  )
}

// ─── Lead row (All Leads tab) ─────────────────────────────────────────────────

function LeadRow({ lead }: { lead: Lead }) {
  const tier   = (lead.tier ?? 2) as 1 | 2 | 3
  const sStyle = STAGE_PILL_STYLE[lead.stage]
  const days   = daysSince(lead.last_contact_at)

  return (
    <a
      href="/pipeline"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '10px 14px',
        borderRadius: 'var(--radius-card)',
        background: 'var(--surface-1)',
        border: '1px solid var(--border)',
        boxShadow: 'var(--shadow-card)',
        textDecoration: 'none',
        transition: 'border-color 120ms ease',
      }}
      onMouseEnter={e => (e.currentTarget as HTMLAnchorElement).style.borderColor = 'var(--border-strong)'}
      onMouseLeave={e => (e.currentTarget as HTMLAnchorElement).style.borderColor = 'var(--border)'}
    >
      {/* Avatar */}
      <div
        style={{
          width: '30px',
          height: '30px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, var(--accent) 0%, var(--purple) 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <span style={{ color: '#fff', fontSize: '11px', fontWeight: '700' }}>
          {(lead.ig_username?.[0] ?? '?').toUpperCase()}
        </span>
      </div>

      {/* Main info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginBottom: '2px' }}>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: '500', color: 'var(--text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            @{lead.ig_username}
          </p>
          <span
            className="badge"
            style={{ background: sStyle.bg, color: sStyle.color, fontSize: '10px', flexShrink: 0 }}
          >
            {STAGE_LABELS[lead.stage]}
          </span>
          <span className={`badge ${TIER_CSS[tier]}`} style={{ fontSize: '10px', flexShrink: 0 }}>
            {TIER_LABEL[tier]}
          </span>
        </div>
        {lead.full_name && (
          <p style={{ fontSize: '11px', color: 'var(--text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {lead.full_name}
          </p>
        )}
      </div>

      {/* Last contact */}
      <div style={{ flexShrink: 0, textAlign: 'right' }}>
        {days === null ? (
          <span style={{ fontSize: '11px', color: 'var(--text-3)' }}>Never</span>
        ) : days === 0 ? (
          <span style={{ fontSize: '11px', color: 'var(--success)', fontWeight: '500' }}>Today</span>
        ) : (
          <span style={{ fontSize: '11px', fontWeight: '500', color: days >= 7 ? 'var(--danger)' : days >= 3 ? 'var(--warning)' : 'var(--text-3)' }}>
            {days}d ago
          </span>
        )}
        <p style={{ fontSize: '10px', color: 'var(--text-3)', marginTop: '1px' }}>last contact</p>
      </div>
    </a>
  )
}

// ─── All Leads view ───────────────────────────────────────────────────────────

const LEAD_STAGE_ORDER: LeadStage[] = ['follower', 'replied', 'freebie_sent', 'call_booked', 'closed', 'nurture', 'bad_fit', 'not_interested']

function AllLeadsView({ leads, loading }: { leads: Lead[]; loading: boolean }) {
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return q ? leads.filter(l => l.ig_username.toLowerCase().includes(q) || l.full_name.toLowerCase().includes(q)) : leads
  }, [leads, search])

  const grouped = useMemo(() => {
    return LEAD_STAGE_ORDER.reduce<Record<LeadStage, Lead[]>>((acc, s) => {
      acc[s] = filtered.filter(l => l.stage === s)
      return acc
    }, {} as Record<LeadStage, Lead[]>)
  }, [filtered])

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '64px 0' }}>
        <p style={{ fontSize: '13px', color: 'var(--text-3)' }}>Loading leads…</p>
      </div>
    )
  }

  if (leads.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '64px 0' }}>
        <p style={{ fontSize: '13px', fontWeight: '500', color: 'var(--text-2)', marginBottom: '4px' }}>No leads yet</p>
        <p style={{ fontSize: '12px', color: 'var(--text-3)' }}>Add leads on the Pipeline page to see them here.</p>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px', maxWidth: '640px' }}>
      {/* Search */}
      <div style={{ position: 'relative' }}>
        <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)', pointerEvents: 'none' }}>
          <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
        </svg>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search leads…"
          className="input-base"
          style={{ paddingLeft: '32px' }}
        />
      </div>

      {/* Grouped by stage */}
      {LEAD_STAGE_ORDER.map(stage => {
        const group = grouped[stage]
        if (!group?.length) return null
        return (
          <div key={stage}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <span className="label-caps">{STAGE_LABELS[stage]}</span>
              <span className="badge" style={{ background: 'var(--surface-3)', color: 'var(--text-2)' }}>{group.length}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {group.sort((a, b) => {
                const da = a.last_contact_at ? new Date(a.last_contact_at).getTime() : 0
                const db = b.last_contact_at ? new Date(b.last_contact_at).getTime() : 0
                return da - db
              }).map(l => <LeadRow key={l.id} lead={l} />)}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function TasksClient({ initialTasks, userId }: { initialTasks: Task[]; userId: string }) {
  const [view, setView]             = useState<'tasks' | 'leads'>('tasks')
  const [tasks, setTasks]           = useState<Task[]>(initialTasks)
  const [leads, setLeads]           = useState<Lead[]>([])
  const [leadsLoading, setLeadsLoading] = useState(false)
  const [filter, setFilter]         = useState<'all' | TaskType>('all')
  const [addOpen, setAddOpen]       = useState(false)
  const [watching, setWatching]     = useState<number | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [generateError, setGenerateError] = useState<string | null>(null)
  const [showDigest, setShowDigest] = useState(false)
  const [digestEnabled, setDigestEnabled] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    supabase.from('users').select('notification_prefs').eq('id', userId).single()
      .then(({ data }) => {
        const raw = data?.notification_prefs as Record<string, unknown> | null
        const enabled = raw?.daily_digest_enabled !== false
        setDigestEnabled(enabled)
        if (enabled) {
          const today = new Date().toISOString().slice(0, 10)
          if (localStorage.getItem(DIGEST_KEY) !== today) setShowDigest(true)
        }
      })
  }, [userId])

  function dismissDigest() {
    setShowDigest(false)
    localStorage.setItem(DIGEST_KEY, new Date().toISOString().slice(0, 10))
  }

  async function generateAndRefresh() {
    setRefreshing(true)
    setGenerateError(null)
    try {
      const res = await fetch('/api/tasks/generate', { method: 'POST' })
      const json = await res.json() as { created?: number; watching?: number; error?: string }
      if (!res.ok || json.error) {
        setGenerateError(json.error ?? `HTTP ${res.status}`)
      } else {
        setWatching(json.watching ?? null)
        const { data, error: dbErr } = await supabase
          .from('tasks').select('*').eq('user_id', userId).eq('completed', false).order('due_at')
        if (dbErr) setGenerateError(dbErr.message)
        else if (data) setTasks(data as Task[])
      }
    } catch (e) {
      setGenerateError(String(e))
    }
    setRefreshing(false)
  }

  async function loadLeads() {
    setLeadsLoading(true)
    const { data } = await supabase
      .from('leads')
      .select('*')
      .eq('user_id', userId)
      .order('last_contact_at', { ascending: true, nullsFirst: true })
    if (data) setLeads(data as Lead[])
    setLeadsLoading(false)
  }

  useEffect(() => { generateAndRefresh() }, [userId])
  useEffect(() => { if (view === 'leads' && leads.length === 0) loadLeads() }, [view])

  const filtered = useMemo(() =>
    filter === 'all' ? tasks : tasks.filter(t => t.type === filter),
    [tasks, filter]
  )

  const grouped = useMemo(() =>
    PRIORITY_ORDER.reduce<Record<TaskPriority, Task[]>>((acc, p) => {
      acc[p] = filtered.filter(t => t.priority === p)
      return acc
    }, { overdue: [], today: [], this_week: [], upcoming: [] }),
    [filtered]
  )

  const totalOpen = tasks.length

  async function handleComplete(id: string) {
    const task = tasks.find(t => t.id === id)
    setTasks(ts => ts.filter(t => t.id !== id))
    await supabase.from('tasks').update({ completed: true, completed_at: new Date().toISOString() }).eq('id', id)
    if (task?.type === 'follow_up' && task.lead_id) {
      await fetch(`/api/leads/${task.lead_id}/contacted`, { method: 'PATCH' })
    }
  }

  function onTaskAdded(task: Task) {
    setTasks(ts => [task, ...ts])
    setAddOpen(false)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

      {/* ── Top bar ───────────────────────────────────────────────────────── */}
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
        {/* Tab switcher */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '2px',
            background: 'var(--surface-2)',
            borderRadius: 'var(--radius-btn)',
            padding: '3px',
          }}
        >
          {(['tasks', 'leads'] as const).map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              style={{
                padding: '5px 12px',
                borderRadius: '5px',
                fontSize: '12px',
                fontWeight: view === v ? '500' : '400',
                color: view === v ? 'var(--text-1)' : 'var(--text-2)',
                background: view === v ? 'var(--surface-1)' : 'transparent',
                border: 'none',
                cursor: 'pointer',
                transition: 'all 120ms ease',
                boxShadow: view === v ? 'var(--shadow-card)' : 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              {v === 'tasks' ? 'Tasks' : 'All leads'}
              {v === 'tasks' && totalOpen > 0 && (
                <span
                  style={{
                    background: 'var(--danger)',
                    color: '#fff',
                    fontSize: '9px',
                    fontWeight: '700',
                    borderRadius: '99px',
                    padding: '0 5px',
                    lineHeight: '16px',
                    height: '16px',
                    display: 'inline-flex',
                    alignItems: 'center',
                  }}
                >
                  {totalOpen}
                </span>
              )}
              {v === 'leads' && leads.length > 0 && (
                <span
                  style={{
                    background: 'var(--surface-3)',
                    color: 'var(--text-2)',
                    fontSize: '9px',
                    fontWeight: '600',
                    borderRadius: '99px',
                    padding: '0 5px',
                    lineHeight: '16px',
                    height: '16px',
                    display: 'inline-flex',
                    alignItems: 'center',
                  }}
                >
                  {leads.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button
            onClick={view === 'tasks' ? generateAndRefresh : loadLeads}
            disabled={view === 'tasks' ? refreshing : leadsLoading}
            title={view === 'tasks' ? 'Refresh tasks' : 'Refresh leads'}
            style={{
              padding: '6px',
              color: 'var(--text-3)',
              background: 'transparent',
              border: 'none',
              borderRadius: 'var(--radius-btn)',
              cursor: 'pointer',
              opacity: (view === 'tasks' ? refreshing : leadsLoading) ? 0.4 : 1,
              display: 'flex',
              alignItems: 'center',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--surface-2)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-1)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-3)' }}
          >
            <svg viewBox="0 0 20 20" fill="currentColor" width="15" height="15" style={{ animation: (view === 'tasks' ? refreshing : leadsLoading) ? 'spin 1s linear infinite' : 'none' }}>
              <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
            </svg>
          </button>
          <button
            onClick={() => setAddOpen(true)}
            className="btn-primary"
            style={{ fontSize: '12px', padding: '5px 12px' }}
          >
            + Add task
          </button>
        </div>
      </div>

      {/* ── Filter bar (tasks only) ───────────────────────────────────────── */}
      {view === 'tasks' && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '8px 24px',
            borderBottom: '1px solid var(--border)',
            background: 'var(--surface-1)',
            overflowX: 'auto',
            flexShrink: 0,
          }}
        >
          {FILTER_TYPES.map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              style={{
                padding: '4px 10px',
                borderRadius: 'var(--radius-badge)',
                fontSize: '11px',
                fontWeight: '500',
                whiteSpace: 'nowrap',
                background: filter === f.key ? 'rgba(37,99,235,0.1)' : 'transparent',
                color: filter === f.key ? 'var(--accent)' : 'var(--text-2)',
                border: 'none',
                cursor: 'pointer',
                transition: 'all 120ms ease',
              }}
              onMouseEnter={e => { if (filter !== f.key) (e.currentTarget as HTMLButtonElement).style.background = 'var(--surface-2)' }}
              onMouseLeave={e => { if (filter !== f.key) (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}

      {/* ── Body ─────────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: 'auto' }}>

        {/* Generate error */}
        {generateError && view === 'tasks' && (
          <div
            style={{
              margin: '12px 24px 0',
              padding: '10px 14px',
              background: 'rgba(220,38,38,0.05)',
              border: '1px solid rgba(220,38,38,0.2)',
              borderRadius: 'var(--radius-card)',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '8px',
            }}
          >
            <span style={{ color: 'var(--danger)', flexShrink: 0, marginTop: '1px', fontSize: '13px' }}>⚠</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: '12px', fontWeight: '600', color: 'var(--danger)', marginBottom: '2px' }}>Task generator error</p>
              <p style={{ fontSize: '11px', color: 'var(--danger)', fontFamily: 'var(--font-mono)', wordBreak: 'break-all', opacity: 0.8 }}>{generateError}</p>
            </div>
            <button
              onClick={() => setGenerateError(null)}
              style={{ color: 'var(--danger)', background: 'none', border: 'none', cursor: 'pointer', opacity: 0.6, fontSize: '13px', flexShrink: 0 }}
            >
              ✕
            </button>
          </div>
        )}

        {/* Daily digest */}
        {view === 'tasks' && showDigest && digestEnabled && watching !== null && (
          <DigestBanner tasks={tasks} watching={watching} onDismiss={dismissDigest} />
        )}

        <div style={{ padding: '16px 24px 32px' }}>
          {view === 'leads' ? (
            <AllLeadsView leads={leads} loading={leadsLoading} />
          ) : totalOpen === 0 ? (
            <div style={{ textAlign: 'center', padding: '64px 0', maxWidth: '360px', margin: '0 auto' }}>
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  background: refreshing ? 'var(--surface-3)' : 'rgba(22,163,74,0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 12px',
                }}
              >
                {refreshing ? (
                  <svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18" style={{ color: 'var(--text-3)', animation: 'spin 1s linear infinite' }}>
                    <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18" style={{ color: 'var(--success)' }}>
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
              </div>
              <p style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text-1)', marginBottom: '6px' }}>
                {refreshing ? 'Checking…' : 'All clear!'}
              </p>
              {!refreshing && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'center' }}>
                  {watching !== null && watching > 0 ? (
                    <p style={{ fontSize: '13px', color: 'var(--text-2)' }}>
                      Watching <strong style={{ color: 'var(--text-1)' }}>{watching} lead{watching !== 1 ? 's' : ''}</strong> — tasks appear automatically based on lead tier.
                    </p>
                  ) : watching === 0 ? (
                    <p style={{ fontSize: '13px', color: 'var(--text-2)' }}>No leads in the pipeline yet.</p>
                  ) : null}
                  <button
                    onClick={() => setView('leads')}
                    className="btn-ghost"
                    style={{ marginTop: '4px' }}
                  >
                    View all leads
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '640px' }}>
              {PRIORITY_ORDER.map(p => (
                <TaskSection key={p} priority={p} tasks={grouped[p]} onComplete={handleComplete} />
              ))}
            </div>
          )}
        </div>
      </div>

      {addOpen && <AddTaskModal userId={userId} onClose={() => setAddOpen(false)} onAdded={onTaskAdded} />}
    </div>
  )
}
