'use client'

import { useState, useMemo, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import type { Task, TaskType, TaskPriority } from '@/types'
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

// ─── Task row ─────────────────────────────────────────────────────────────────

function TaskRow({
  task, onComplete,
}: {
  task: Task
  onComplete: (id: string) => void
}) {
  const [fading, setFading] = useState(false)
  const style = TASK_TYPE_STYLES[task.type]
  const dotColor = PRIORITY_COLORS[task.priority]

  function handleCheck() {
    setFading(true)
    setTimeout(() => onComplete(task.id), 600)
  }

  const isOverdue = task.priority === 'overdue'

  // Extract @username from title if present (e.g. "Follow up — @johndoe")
  const usernameMatch = task.title.match(/@([\w.]+)/)
  const leadUsername = usernameMatch ? usernameMatch[1] : null

  return (
    <div
      className={`flex items-start gap-3 py-3 px-4 rounded-xl border transition-all ${fading ? 'task-fade-out pointer-events-none' : ''} ${
        isOverdue
          ? 'bg-red-50 dark:bg-red-900/10 border-red-100 dark:border-red-800/30'
          : 'bg-white dark:bg-slate-800 border-gray-100 dark:border-slate-700'
      }`}
    >
      {/* Dot */}
      <span className={`w-2.5 h-2.5 rounded-full mt-1 flex-shrink-0 ${dotColor}`} />

      {/* Checkbox */}
      <button
        onClick={handleCheck}
        className="w-5 h-5 rounded-md border-2 border-gray-200 dark:border-slate-600 flex-shrink-0 mt-0.5 hover:border-green-400 transition-colors flex items-center justify-center"
      >
        {fading && (
          <svg viewBox="0 0 12 12" fill="none" className="w-3 h-3">
            <path d="M2 6l3 3 5-5" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
          <p className="text-sm font-semibold text-gray-900 dark:text-slate-100 truncate">{task.title}</p>
          <span
            className="text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
            style={{ background: style.bg, color: style.text }}
          >
            {style.label}
          </span>
          {task.lead_id && leadUsername && (
            <a
              href="/pipeline"
              onClick={e => e.stopPropagation()}
              className="text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
            >
              @{leadUsername}
            </a>
          )}
        </div>
        <p className="text-xs text-gray-500 dark:text-slate-400 line-clamp-2">{task.description}</p>
      </div>

      {/* Date */}
      <span className={`text-xs flex-shrink-0 mt-0.5 ${isOverdue ? 'text-red-500 dark:text-red-400 font-semibold' : 'text-gray-400 dark:text-slate-500'}`}>
        {formatDueDate(task.due_at)}
      </span>
    </div>
  )
}

// ─── Section ──────────────────────────────────────────────────────────────────

function TaskSection({
  priority, tasks, onComplete,
}: {
  priority: TaskPriority
  tasks: Task[]
  onComplete: (id: string) => void
}) {
  if (tasks.length === 0) return null

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <h2 className="text-sm font-bold text-gray-900 dark:text-slate-100">{PRIORITY_LABELS[priority]}</h2>
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${PRIORITY_BADGE_COLORS[priority]}`}>
          {tasks.length}
        </span>
      </div>
      <div className="space-y-2">
        {tasks.map(t => <TaskRow key={t.id} task={t} onComplete={onComplete} />)}
      </div>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function TasksClient({ initialTasks, userId }: { initialTasks: Task[]; userId: string }) {
  const [tasks, setTasks] = useState<Task[]>(initialTasks)
  const [filter, setFilter] = useState<'all' | TaskType>('all')
  const [addOpen, setAddOpen] = useState(false)
  const [watching, setWatching] = useState<number | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const supabase = createClient()

  async function generateAndRefresh() {
    setRefreshing(true)
    try {
      const res = await fetch('/api/tasks/generate', { method: 'POST' })
      if (res.ok) {
        const json = await res.json() as { created: number; watching: number }
        setWatching(json.watching ?? null)
        // Always reload — even if 0 created, tasks might have been completed elsewhere
        const { data } = await supabase
          .from('tasks')
          .select('*')
          .eq('user_id', userId)
          .eq('completed', false)
          .order('due_at')
        if (data) setTasks(data as Task[])
      }
    } catch {
      // Non-critical
    }
    setRefreshing(false)
  }

  // Run on mount
  useEffect(() => { generateAndRefresh() }, [userId])

  const filtered = useMemo(() =>
    filter === 'all' ? tasks : tasks.filter(t => t.type === filter),
    [tasks, filter]
  )

  const grouped = useMemo(() => {
    return PRIORITY_ORDER.reduce<Record<TaskPriority, Task[]>>((acc, p) => {
      acc[p] = filtered.filter(t => t.priority === p)
      return acc
    }, { overdue: [], today: [], this_week: [], upcoming: [] })
  }, [filtered])

  const totalOpen = tasks.length

  async function handleComplete(id: string) {
    const task = tasks.find(t => t.id === id)
    setTasks(ts => ts.filter(t => t.id !== id))
    await supabase.from('tasks').update({
      completed: true,
      completed_at: new Date().toISOString(),
    }).eq('id', id)
    // For follow_up tasks linked to a lead, reset the lead's follow-up timer
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
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100">Tasks</h1>
          {totalOpen > 0 && (
            <span className="bg-red-100 text-red-700 text-xs font-bold px-2 py-0.5 rounded-full">{totalOpen}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={generateAndRefresh}
            disabled={refreshing}
            className="p-1.5 text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-40"
            title="Refresh tasks"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`}>
              <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
            </svg>
          </button>
          <button
            onClick={() => setAddOpen(true)}
            className="px-4 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            + Add task
          </button>
        </div>
      </div>

      {/* Filter bar */}
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

      {/* Task list */}
      <div className="flex-1 overflow-y-auto p-6">
        {totalOpen === 0 ? (
          <div className="text-center py-16 max-w-sm mx-auto">
            <p className="text-4xl mb-3">{refreshing ? '⏳' : '✅'}</p>
            <p className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-1">
              {refreshing ? 'Checking…' : 'No open tasks'}
            </p>
            {!refreshing && (
              <div className="space-y-3">
                {watching !== null && watching > 0 ? (
                  <p className="text-sm text-gray-500 dark:text-slate-400">
                    Watching <span className="font-semibold text-gray-700 dark:text-slate-300">{watching} lead{watching !== 1 ? 's' : ''}</span> — follow-up tasks appear automatically when they go {' '}
                    <span className="font-semibold text-gray-700 dark:text-slate-300">3+ days</span> without contact.
                  </p>
                ) : watching === 0 ? (
                  <p className="text-sm text-gray-500 dark:text-slate-400">
                    No leads in the pipeline yet. Add leads on the Pipeline page and tasks will appear here automatically.
                  </p>
                ) : null}
                <p className="text-xs text-gray-400 dark:text-slate-500">
                  Tasks also appear when you book a call, have a payment due, or when it&apos;s time to upsell a client.
                </p>
                <button
                  onClick={() => setAddOpen(true)}
                  className="mt-2 px-4 py-2 border border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-400 text-sm font-medium rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
                >
                  + Add a task manually
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

      {addOpen && (
        <AddTaskModal
          userId={userId}
          onClose={() => setAddOpen(false)}
          onAdded={onTaskAdded}
        />
      )}
    </div>
  )
}
