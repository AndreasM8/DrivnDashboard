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

const PRIORITY_COLORS: Record<TaskPriority, string> = {
  overdue:   'bg-red-500',
  today:     'bg-amber-400',
  this_week: 'bg-gray-400',
  upcoming:  'bg-purple-400',
}

const PRIORITY_LABELS: Record<TaskPriority, string> = {
  overdue:   'Overdue',
  today:     'Today',
  this_week: 'This week',
  upcoming:  'Coming up',
}

const PRIORITY_BADGE_COLORS: Record<TaskPriority, string> = {
  overdue:   'bg-red-100 text-red-700',
  today:     'bg-amber-100 text-amber-700',
  this_week: 'bg-gray-100 text-gray-600',
  upcoming:  'bg-purple-100 text-purple-700',
}

const FILTER_TYPES: { key: 'all' | TaskType; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'follow_up', label: 'Follow-ups' },
  { key: 'payment', label: 'Payments' },
  { key: 'upsell', label: 'Upsells' },
  { key: 'nurture', label: 'Nurture' },
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

const STAGE_COLORS: Record<LeadStage, string> = {
  follower:       'bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-slate-300',
  replied:        'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  freebie_sent:   'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  call_booked:    'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  closed:         'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  nurture:        'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300',
  bad_fit:        'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
  not_interested: 'bg-gray-100 text-gray-500 dark:bg-slate-700 dark:text-slate-400',
}

const TIER_STYLES: Record<1 | 2 | 3, { label: string; icon: string; cls: string }> = {
  1: { label: 'T1', icon: '🔥', cls: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  2: { label: 'T2', icon: '💪', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  3: { label: 'T3', icon: '🌱', cls: 'bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-slate-400' },
}

// ─── Daily digest banner ──────────────────────────────────────────────────────

const DIGEST_KEY = 'drivn_digest_date'

function DigestBanner({ tasks, watching, onDismiss }: { tasks: Task[]; watching: number; onDismiss: () => void }) {
  const overdue = tasks.filter(t => t.priority === 'overdue').length
  const today   = tasks.filter(t => t.priority === 'today').length
  const hour    = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const items: { icon: string; text: string; color: string }[] = []
  if (overdue > 0)  items.push({ icon: '🔴', text: `${overdue} overdue task${overdue !== 1 ? 's' : ''}`,      color: 'text-red-700 dark:text-red-400' })
  if (today   > 0)  items.push({ icon: '🟡', text: `${today} due today`,                                       color: 'text-amber-700 dark:text-amber-400' })
  if (watching > 0) items.push({ icon: '👀', text: `Watching ${watching} lead${watching !== 1 ? 's' : ''}`,    color: 'text-blue-700 dark:text-blue-400' })
  if (items.length === 0) items.push({ icon: '✅', text: 'No open tasks — great work!', color: 'text-green-700 dark:text-green-400' })

  return (
    <div className="mx-6 mt-5 mb-1 rounded-xl border border-blue-100 dark:border-blue-900/40 bg-blue-50 dark:bg-blue-900/20 px-4 py-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <p className="text-sm font-semibold text-blue-900 dark:text-blue-200 mb-2">{greeting} 👋</p>
          <div className="space-y-1">
            {items.map((item, i) => (
              <p key={i} className={`text-xs font-medium flex items-center gap-1.5 ${item.color}`}>
                <span>{item.icon}</span>{item.text}
              </p>
            ))}
          </div>
        </div>
        <button onClick={onDismiss} className="text-blue-400 dark:text-blue-600 hover:text-blue-600 dark:hover:text-blue-400 transition-colors flex-shrink-0 mt-0.5">
          <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4">
            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L8 6.586l2.293-2.293a1 1 0 111.414 1.414L9.414 8l2.293 2.293a1 1 0 01-1.414 1.414L8 9.414l-2.293 2.293a1 1 0 01-1.414-1.414L6.586 8 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </button>
      </div>
    </div>
  )
}

// ─── Task row ─────────────────────────────────────────────────────────────────

function TaskRow({ task, onComplete }: { task: Task; onComplete: (id: string) => void }) {
  const [fading, setFading] = useState(false)
  const style    = TASK_TYPE_STYLES[task.type]
  const dotColor = PRIORITY_COLORS[task.priority]
  const isOverdue = task.priority === 'overdue'
  const usernameMatch = task.title.match(/@([\w.]+)/)
  const leadUsername  = usernameMatch ? usernameMatch[1] : null

  function handleCheck() {
    setFading(true)
    setTimeout(() => onComplete(task.id), 600)
  }

  return (
    <div className={`flex items-start gap-3 py-3 px-4 rounded-xl border transition-all ${fading ? 'opacity-0 scale-95 pointer-events-none' : ''} ${
      isOverdue ? 'bg-red-50 dark:bg-red-900/10 border-red-100 dark:border-red-800/30'
                : 'bg-white dark:bg-slate-800 border-gray-100 dark:border-slate-700'
    }`}>
      <span className={`w-2.5 h-2.5 rounded-full mt-1 flex-shrink-0 ${dotColor}`} />
      <button onClick={handleCheck} className="w-5 h-5 rounded-md border-2 border-gray-200 dark:border-slate-600 flex-shrink-0 mt-0.5 hover:border-green-400 transition-colors flex items-center justify-center">
        {fading && <svg viewBox="0 0 12 12" fill="none" className="w-3 h-3"><path d="M2 6l3 3 5-5" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>}
      </button>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
          <p className="text-sm font-semibold text-gray-900 dark:text-slate-100 truncate">{task.title}</p>
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0" style={{ background: style.bg, color: style.text }}>{style.label}</span>
          {task.lead_id && leadUsername && (
            <a href="/pipeline" onClick={e => e.stopPropagation()} className="text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 hover:bg-blue-200 transition-colors">
              @{leadUsername}
            </a>
          )}
        </div>
        <p className="text-xs text-gray-500 dark:text-slate-400 line-clamp-2">{task.description}</p>
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0 mt-0.5">
        {task.reminder_at && (
          <span title={`Reminder: ${formatDueDate(task.reminder_at)}`}>
            <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5 text-blue-400">
              <path d="M8 1a5 5 0 00-5 5v2.586l-.707.707A1 1 0 003 11h10a1 1 0 00.707-1.707L13 8.586V6a5 5 0 00-5-5zm0 13a1.5 1.5 0 01-1.5-1.5h3A1.5 1.5 0 018 14z" />
            </svg>
          </span>
        )}
        <span className={`text-xs ${isOverdue ? 'text-red-500 font-semibold' : 'text-gray-400 dark:text-slate-500'}`}>
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
      <div className="flex items-center gap-2 mb-3">
        <h2 className="text-sm font-bold text-gray-900 dark:text-slate-100">{PRIORITY_LABELS[priority]}</h2>
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${PRIORITY_BADGE_COLORS[priority]}`}>{tasks.length}</span>
      </div>
      <div className="space-y-2">
        {tasks.map(t => <TaskRow key={t.id} task={t} onComplete={onComplete} />)}
      </div>
    </div>
  )
}

// ─── Lead row (All Leads tab) ─────────────────────────────────────────────────

function LeadRow({ lead }: { lead: Lead }) {
  const tier    = (lead.tier ?? 2) as 1 | 2 | 3
  const tStyle  = TIER_STYLES[tier]
  const sColor  = STAGE_COLORS[lead.stage]
  const days    = daysSince(lead.last_contact_at)

  return (
    <a
      href="/pipeline"
      className="flex items-center gap-3 py-3 px-4 rounded-xl border bg-white dark:bg-slate-800 border-gray-100 dark:border-slate-700 hover:border-blue-200 dark:hover:border-blue-700 transition-colors"
    >
      {/* Avatar */}
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center flex-shrink-0">
        <span className="text-white text-xs font-bold">
          {(lead.ig_username?.[0] ?? '?').toUpperCase()}
        </span>
      </div>

      {/* Main info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <p className="text-sm font-semibold text-gray-900 dark:text-slate-100 truncate">@{lead.ig_username}</p>
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${sColor}`}>
            {STAGE_LABELS[lead.stage]}
          </span>
          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0 ${tStyle.cls}`}>
            {tStyle.icon} {tStyle.label}
          </span>
        </div>
        {lead.full_name && (
          <p className="text-xs text-gray-400 dark:text-slate-500 truncate">{lead.full_name}</p>
        )}
      </div>

      {/* Last contact */}
      <div className="flex-shrink-0 text-right">
        {days === null ? (
          <span className="text-xs text-gray-300 dark:text-slate-600">Never</span>
        ) : days === 0 ? (
          <span className="text-xs text-green-500 font-medium">Today</span>
        ) : (
          <span className={`text-xs font-medium ${days >= 7 ? 'text-red-500' : days >= 3 ? 'text-amber-500' : 'text-gray-400 dark:text-slate-500'}`}>
            {days}d ago
          </span>
        )}
        <p className="text-[10px] text-gray-300 dark:text-slate-600">last contact</p>
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

  // Group by stage
  const grouped = useMemo(() => {
    return LEAD_STAGE_ORDER.reduce<Record<LeadStage, Lead[]>>((acc, s) => {
      acc[s] = filtered.filter(l => l.stage === s)
      return acc
    }, {} as Record<LeadStage, Lead[]>)
  }, [filtered])

  if (loading) {
    return (
      <div className="text-center py-16">
        <p className="text-2xl mb-2">⏳</p>
        <p className="text-sm text-gray-400 dark:text-slate-500">Loading leads…</p>
      </div>
    )
  }

  if (leads.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-2xl mb-2">👥</p>
        <p className="text-sm font-semibold text-gray-700 dark:text-slate-300">No leads yet</p>
        <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">Add leads on the Pipeline page to see them here.</p>
      </div>
    )
  }

  return (
    <div className="space-y-8 max-w-2xl">
      {/* Search */}
      <div className="relative">
        <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500 pointer-events-none">
          <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
        </svg>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search leads…"
          className="w-full pl-9 pr-4 py-2.5 border border-gray-200 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Grouped by stage */}
      {LEAD_STAGE_ORDER.map(stage => {
        const group = grouped[stage]
        if (!group?.length) return null
        return (
          <div key={stage}>
            <div className="flex items-center gap-2 mb-3">
              <h2 className="text-sm font-bold text-gray-900 dark:text-slate-100">{STAGE_LABELS[stage]}</h2>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400">
                {group.length}
              </span>
            </div>
            <div className="space-y-2">
              {group.sort((a, b) => {
                // Sort by last contact ascending (longest without contact first)
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
  const [view, setView] = useState<'tasks' | 'leads'>('tasks')
  const [tasks, setTasks] = useState<Task[]>(initialTasks)
  const [leads, setLeads] = useState<Lead[]>([])
  const [leadsLoading, setLeadsLoading] = useState(false)
  const [filter, setFilter] = useState<'all' | TaskType>('all')
  const [addOpen, setAddOpen] = useState(false)
  const [watching, setWatching] = useState<number | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [generateError, setGenerateError] = useState<string | null>(null)
  const [showDigest, setShowDigest] = useState(false)
  const [digestEnabled, setDigestEnabled] = useState(false)
  const supabase = createClient()

  // Load digest preference
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

  // On mount: generate tasks
  useEffect(() => { generateAndRefresh() }, [userId])

  // Load leads when switching to leads tab
  useEffect(() => {
    if (view === 'leads' && leads.length === 0) loadLeads()
  }, [view])

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
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-slate-700 bg-white dark:bg-slate-800">
        <div className="flex items-center gap-1 bg-gray-100 dark:bg-slate-700 rounded-xl p-1">
          <button
            onClick={() => setView('tasks')}
            className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${
              view === 'tasks'
                ? 'bg-white dark:bg-slate-600 text-gray-900 dark:text-slate-100 shadow-sm'
                : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-300'
            }`}
          >
            Tasks
            {totalOpen > 0 && (
              <span className="ml-1.5 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{totalOpen}</span>
            )}
          </button>
          <button
            onClick={() => setView('leads')}
            className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${
              view === 'leads'
                ? 'bg-white dark:bg-slate-600 text-gray-900 dark:text-slate-100 shadow-sm'
                : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-300'
            }`}
          >
            All leads
            {leads.length > 0 && (
              <span className="ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-gray-200 dark:bg-slate-600 text-gray-600 dark:text-slate-400">{leads.length}</span>
            )}
          </button>
        </div>

        <div className="flex items-center gap-2">
          {view === 'tasks' && (
            <button
              onClick={generateAndRefresh}
              disabled={refreshing}
              className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-40"
              title="Refresh tasks"
            >
              <svg viewBox="0 0 20 20" fill="currentColor" className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`}>
                <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
              </svg>
            </button>
          )}
          {view === 'leads' && (
            <button
              onClick={loadLeads}
              disabled={leadsLoading}
              className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-40"
              title="Refresh leads"
            >
              <svg viewBox="0 0 20 20" fill="currentColor" className={`w-4 h-4 ${leadsLoading ? 'animate-spin' : ''}`}>
                <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
              </svg>
            </button>
          )}
          <button
            onClick={() => setAddOpen(true)}
            className="px-4 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            + Add task
          </button>
        </div>
      </div>

      {/* Filter bar — tasks only */}
      {view === 'tasks' && (
        <div className="flex items-center gap-2 px-6 py-3 border-b border-gray-50 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-x-auto">
          {FILTER_TYPES.map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                filter === f.key ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700' : 'text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        {/* Generate error */}
        {generateError && view === 'tasks' && (
          <div className="mx-6 mt-3 px-4 py-2.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 rounded-xl flex items-start gap-2">
            <span className="text-red-500 flex-shrink-0 mt-0.5">⚠</span>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-red-700 dark:text-red-400">Task generator error</p>
              <p className="text-xs text-red-600 dark:text-red-500 font-mono break-all">{generateError}</p>
            </div>
            <button onClick={() => setGenerateError(null)} className="text-red-400 hover:text-red-600 flex-shrink-0">✕</button>
          </div>
        )}

        {/* Daily digest */}
        {view === 'tasks' && showDigest && digestEnabled && watching !== null && (
          <DigestBanner tasks={tasks} watching={watching} onDismiss={dismissDigest} />
        )}

        <div className="p-6">
          {view === 'leads' ? (
            <AllLeadsView leads={leads} loading={leadsLoading} />
          ) : totalOpen === 0 ? (
            <div className="text-center py-16 max-w-sm mx-auto">
              <p className="text-4xl mb-3">{refreshing ? '⏳' : '✅'}</p>
              <p className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-1">
                {refreshing ? 'Checking…' : 'All clear!'}
              </p>
              {!refreshing && (
                <div className="space-y-3">
                  {watching !== null && watching > 0 ? (
                    <p className="text-sm text-gray-500 dark:text-slate-400">
                      Watching <span className="font-semibold text-gray-700 dark:text-slate-300">{watching} lead{watching !== 1 ? 's' : ''}</span> — tasks appear automatically based on lead tier.
                    </p>
                  ) : watching === 0 ? (
                    <p className="text-sm text-gray-500 dark:text-slate-400">No leads in the pipeline yet.</p>
                  ) : null}
                  <button
                    onClick={() => setView('leads')}
                    className="mt-2 px-4 py-2 border border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-400 text-sm font-medium rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
                  >
                    👥 View all leads
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-8 max-w-2xl">
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
