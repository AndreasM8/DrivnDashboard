'use client'

import { useState, useMemo } from 'react'
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

  return (
    <div
      className={`flex items-start gap-3 py-3 px-4 bg-white rounded-xl border border-gray-100 transition-all ${fading ? 'task-fade-out pointer-events-none' : ''}`}
    >
      {/* Dot */}
      <span className={`w-2.5 h-2.5 rounded-full mt-1 flex-shrink-0 ${dotColor}`} />

      {/* Checkbox */}
      <button
        onClick={handleCheck}
        className="w-5 h-5 rounded-md border-2 border-gray-200 flex-shrink-0 mt-0.5 hover:border-green-400 transition-colors flex items-center justify-center"
      >
        {fading && (
          <svg viewBox="0 0 12 12" fill="none" className="w-3 h-3">
            <path d="M2 6l3 3 5-5" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <p className="text-sm font-semibold text-gray-900 truncate">{task.title}</p>
          <span
            className="text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
            style={{ background: style.bg, color: style.text }}
          >
            {style.label}
          </span>
        </div>
        <p className="text-xs text-gray-500 line-clamp-2">{task.description}</p>
      </div>

      {/* Date */}
      <span className="text-xs text-gray-400 flex-shrink-0 mt-0.5">{formatDueDate(task.due_at)}</span>
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
        <h2 className="text-sm font-bold text-gray-900">{PRIORITY_LABELS[priority]}</h2>
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
  const supabase = createClient()

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
    setTasks(ts => ts.filter(t => t.id !== id))
    await supabase.from('tasks').update({
      completed: true,
      completed_at: new Date().toISOString(),
    }).eq('id', id)
  }

  function onTaskAdded(task: Task) {
    setTasks(ts => [task, ...ts])
    setAddOpen(false)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-white">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold text-gray-900">Tasks</h1>
          {totalOpen > 0 && (
            <span className="bg-red-100 text-red-700 text-xs font-bold px-2 py-0.5 rounded-full">{totalOpen}</span>
          )}
        </div>
        <button
          onClick={() => setAddOpen(true)}
          className="px-4 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          + Add task
        </button>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-2 px-6 py-3 border-b border-gray-50 bg-white overflow-x-auto">
        {FILTER_TYPES.map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
              filter === f.key ? 'bg-blue-100 text-blue-700' : 'text-gray-500 hover:bg-gray-100'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Task list */}
      <div className="flex-1 overflow-y-auto p-6">
        {totalOpen === 0 ? (
          <div className="text-center py-20">
            <p className="text-4xl mb-3">🎉</p>
            <p className="text-lg font-semibold text-gray-900 mb-1">Nothing due today — you&apos;re on top of it!</p>
            <p className="text-sm text-gray-500">New tasks appear here automatically. Or hit + Add task to create one manually.</p>
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
