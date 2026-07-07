'use client'

import { useState } from 'react'
import type { TeamPersonalTask, TeamTask } from '@/types'

type Priority = TeamPersonalTask['priority']

const PRIORITY_LABEL: Record<Priority, string> = {
  today: 'Today',
  this_week: 'This week',
  later: 'Later',
}

interface Props {
  memberId: string
  initialTasks: TeamPersonalTask[]
  coachTasks: TeamTask[]
}

export default function MyTasksClient({ memberId, initialTasks, coachTasks: initialCoachTasks }: Props) {
  const [tasks, setTasks] = useState<TeamPersonalTask[]>(initialTasks)
  const [coachTasks, setCoachTasks] = useState<TeamTask[]>(initialCoachTasks)
  const [newTitle, setNewTitle] = useState('')
  const [newPriority, setNewPriority] = useState<Priority>('this_week')
  const [adding, setAdding] = useState(false)
  const [toggling, setToggling] = useState<Set<string>>(new Set())
  const [deleting, setDeleting] = useState<Set<string>>(new Set())
  const [togglingCoach, setTogglingCoach] = useState<Set<string>>(new Set())

  async function addTask(e: React.FormEvent) {
    e.preventDefault()
    if (!newTitle.trim() || adding) return
    setAdding(true)
    try {
      const res = await fetch('/api/team/personal-tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle.trim(), priority: newPriority, team_member_id: memberId }),
      })
      if (res.ok) {
        const data = await res.json() as { task: TeamPersonalTask }
        setTasks(prev => [data.task, ...prev])
        setNewTitle('')
      }
    } finally {
      setAdding(false)
    }
  }

  async function toggleDone(task: TeamPersonalTask) {
    if (toggling.has(task.id)) return
    setToggling(prev => new Set(prev).add(task.id))
    try {
      const res = await fetch(`/api/team/personal-tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ done: !task.done }),
      })
      if (res.ok) {
        setTasks(prev => prev.map(t => t.id === task.id ? { ...t, done: !t.done } : t))
      }
    } finally {
      setToggling(prev => { const n = new Set(prev); n.delete(task.id); return n })
    }
  }

  async function toggleCoachTask(task: TeamTask) {
    if (togglingCoach.has(task.id)) return
    setTogglingCoach(prev => new Set(prev).add(task.id))
    try {
      const res = await fetch(`/api/team/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ done: !task.done }),
      })
      if (res.ok) {
        setCoachTasks(prev => prev.map(t => t.id === task.id ? { ...t, done: !t.done } : t))
      }
    } finally {
      setTogglingCoach(prev => { const n = new Set(prev); n.delete(task.id); return n })
    }
  }

  async function deleteTask(id: string) {
    if (deleting.has(id)) return
    setDeleting(prev => new Set(prev).add(id))
    try {
      await fetch(`/api/team/personal-tasks/${id}`, { method: 'DELETE' })
      setTasks(prev => prev.filter(t => t.id !== id))
    } finally {
      setDeleting(prev => { const n = new Set(prev); n.delete(id); return n })
    }
  }

  const open = tasks.filter(t => !t.done)
  const done = tasks.filter(t => t.done)
  const coachOpen = coachTasks.filter(t => !t.done)
  const coachDone = coachTasks.filter(t => t.done)

  return (
    <div style={{ maxWidth: 640, margin: '0 auto' }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-1)', margin: '0 0 4px' }}>My Tasks</h1>
        <p style={{ fontSize: 14, color: 'var(--text-2)', margin: 0 }}>Your tasks and assignments from your coach</p>
      </div>

      {/* Assigned by coach */}
      {coachTasks.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>
              Assigned by coach
            </p>
            <span style={{
              fontSize: 10, fontWeight: 700, background: 'rgba(99,102,241,0.12)',
              color: 'var(--accent)', borderRadius: 4, padding: '1px 6px',
            }}>
              {coachOpen.length} open
            </span>
          </div>
          <div style={{ background: 'var(--surface-1)', border: '1px solid var(--border-glow)', borderRadius: 'var(--radius-card)', overflow: 'hidden' }}>
            {coachOpen.map((task, i) => (
              <CoachTaskRow
                key={task.id}
                task={task}
                toggling={togglingCoach.has(task.id)}
                onToggle={toggleCoachTask}
                bordered={i < coachOpen.length - 1 || coachDone.length > 0}
              />
            ))}
            {coachDone.map((task, i) => (
              <CoachTaskRow
                key={task.id}
                task={task}
                toggling={togglingCoach.has(task.id)}
                onToggle={toggleCoachTask}
                bordered={i < coachDone.length - 1}
                dim
              />
            ))}
          </div>
        </div>
      )}

      {/* Add task form */}
      <form onSubmit={addTask} style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <input
          value={newTitle}
          onChange={e => setNewTitle(e.target.value)}
          placeholder="Add a task…"
          style={{
            flex: 1, padding: '10px 14px', background: 'var(--surface-1)',
            border: '1px solid var(--border)', borderRadius: 8, fontSize: 14,
            color: 'var(--text-1)', outline: 'none',
          }}
        />
        <select
          value={newPriority}
          onChange={e => setNewPriority(e.target.value as Priority)}
          style={{
            padding: '10px 12px', background: 'var(--surface-1)',
            border: '1px solid var(--border)', borderRadius: 8, fontSize: 13,
            color: 'var(--text-1)', cursor: 'pointer',
          }}
        >
          <option value="today">Today</option>
          <option value="this_week">This week</option>
          <option value="later">Later</option>
        </select>
        <button
          type="submit"
          disabled={!newTitle.trim() || adding}
          style={{
            padding: '10px 18px', background: '#2563EB', color: '#fff',
            border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600,
            cursor: !newTitle.trim() || adding ? 'not-allowed' : 'pointer',
            opacity: !newTitle.trim() || adding ? 0.6 : 1,
          }}
        >
          Add
        </button>
      </form>

      {tasks.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 48, background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: 'var(--radius-card)' }}>
          <p style={{ fontSize: 28, marginBottom: 8 }}>📋</p>
          <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-1)', marginBottom: 4 }}>No tasks yet</p>
          <p style={{ fontSize: 13, color: 'var(--text-2)', margin: 0 }}>Add your first private task above.</p>
        </div>
      ) : (
        <>
          {open.length > 0 && (
            <TaskSection
              tasks={open} toggling={toggling} deleting={deleting}
              onToggle={toggleDone} onDelete={deleteTask} title="Open"
            />
          )}
          {done.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <TaskSection
                tasks={done} toggling={toggling} deleting={deleting}
                onToggle={toggleDone} onDelete={deleteTask} title="Done" dim
              />
            </div>
          )}
        </>
      )}
    </div>
  )
}

function CoachTaskRow({
  task, toggling, onToggle, bordered, dim,
}: {
  task: TeamTask
  toggling: boolean
  onToggle: (t: TeamTask) => void
  bordered?: boolean
  dim?: boolean
}) {
  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px',
        borderBottom: bordered ? '1px solid var(--border)' : 'none',
        opacity: dim ? 0.5 : 1,
      }}
    >
      <div
        style={{
          width: 20, height: 20, borderRadius: 5, flexShrink: 0,
          border: task.done ? 'none' : '2px solid var(--accent)',
          background: task.done ? 'var(--accent)' : 'transparent',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: toggling ? 'wait' : 'pointer',
        }}
        onClick={() => onToggle(task)}
      >
        {task.done && (
          <svg viewBox="0 0 12 12" fill="none" width="10" height="10">
            <path d="M2 6l3 3 5-5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </div>
      <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => onToggle(task)}>
        <p style={{ fontSize: 14, color: 'var(--text-1)', margin: 0, textDecoration: task.done ? 'line-through' : 'none' }}>
          {task.title}
        </p>
        {task.description && (
          <p style={{ fontSize: 12, color: 'var(--text-3)', margin: '2px 0 0' }}>{task.description}</p>
        )}
        <p style={{ fontSize: 11, color: 'var(--text-3)', margin: '2px 0 0' }}>
          {PRIORITY_LABEL[task.priority]}
        </p>
      </div>
    </div>
  )
}

function TaskSection({
  tasks, toggling, deleting, onToggle, onDelete, title, dim,
}: {
  tasks: TeamPersonalTask[]
  toggling: Set<string>
  deleting: Set<string>
  onToggle: (t: TeamPersonalTask) => void
  onDelete: (id: string) => void
  title: string
  dim?: boolean
}) {
  return (
    <>
      <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
        {title}
      </p>
      <div style={{
        background: 'var(--surface-1)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-card)', overflow: 'hidden', opacity: dim ? 0.6 : 1,
      }}>
        {tasks.map((task, i) => (
          <div
            key={task.id}
            style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px',
              borderBottom: i < tasks.length - 1 ? '1px solid var(--border)' : 'none',
            }}
          >
            <div
              style={{
                width: 20, height: 20, borderRadius: 5, flexShrink: 0,
                border: task.done ? 'none' : '2px solid var(--border-strong)',
                background: task.done ? '#10B981' : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: toggling.has(task.id) ? 'wait' : 'pointer',
              }}
              onClick={() => onToggle(task)}
            >
              {task.done && (
                <svg viewBox="0 0 12 12" fill="none" width="10" height="10">
                  <path d="M2 6l3 3 5-5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </div>
            <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => onToggle(task)}>
              <p style={{ fontSize: 14, color: 'var(--text-1)', margin: 0, textDecoration: task.done ? 'line-through' : 'none' }}>
                {task.title}
              </p>
              <p style={{ fontSize: 11, color: 'var(--text-3)', margin: 0 }}>
                {PRIORITY_LABEL[task.priority]}
              </p>
            </div>
            <button
              onClick={() => onDelete(task.id)}
              disabled={deleting.has(task.id)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--text-3)', padding: 4, opacity: deleting.has(task.id) ? 0.4 : 1,
              }}
              title="Delete"
            >
              <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14">
                <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </>
  )
}
