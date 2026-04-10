'use client'

import { useState } from 'react'
import type { TeamTask } from '@/types'

const PRIORITY_LABEL: Record<TeamTask['priority'], string> = {
  today: 'Today',
  this_week: 'This week',
  later: 'Later',
}

const PRIORITY_COLOR: Record<TeamTask['priority'], string> = {
  today: '#EF4444',
  this_week: '#F59E0B',
  later: 'var(--text-3)',
}

interface Props {
  initialTasks: TeamTask[]
}

export default function TeamTasksClient({ initialTasks }: Props) {
  const [tasks, setTasks] = useState<TeamTask[]>(initialTasks)
  const [toggling, setToggling] = useState<Set<string>>(new Set())

  async function toggleDone(task: TeamTask) {
    if (toggling.has(task.id)) return
    setToggling(prev => new Set(prev).add(task.id))

    try {
      const res = await fetch(`/api/team/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ done: !task.done }),
      })
      if (res.ok) {
        setTasks(prev => prev.map(t => t.id === task.id ? { ...t, done: !t.done } : t))
      }
    } finally {
      setToggling(prev => {
        const next = new Set(prev)
        next.delete(task.id)
        return next
      })
    }
  }

  const open = tasks.filter(t => !t.done)
  const done = tasks.filter(t => t.done)

  return (
    <div style={{ maxWidth: 640, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-1)', margin: '0 0 4px' }}>Team Tasks</h1>
        <p style={{ fontSize: 14, color: 'var(--text-2)', margin: 0 }}>Tasks from your coach — mark done when complete</p>
      </div>

      {tasks.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 48, background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: 'var(--radius-card)' }}>
          <p style={{ fontSize: 28, marginBottom: 8 }}>👥</p>
          <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-1)', marginBottom: 4 }}>No team tasks yet</p>
          <p style={{ fontSize: 13, color: 'var(--text-2)', margin: 0 }}>Your coach hasn&apos;t created any tasks for the team.</p>
        </div>
      ) : (
        <>
          {open.length > 0 && (
            <TaskList tasks={open} toggling={toggling} onToggle={toggleDone} title="Open" />
          )}
          {done.length > 0 && (
            <div style={{ marginTop: 20 }}>
              <TaskList tasks={done} toggling={toggling} onToggle={toggleDone} title="Completed" dim />
            </div>
          )}
        </>
      )}
    </div>
  )
}

function TaskList({
  tasks, toggling, onToggle, title, dim,
}: {
  tasks: TeamTask[]
  toggling: Set<string>
  onToggle: (t: TeamTask) => void
  title: string
  dim?: boolean
}) {
  return (
    <>
      <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
        {title}
      </p>
      <div style={{ background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: 'var(--radius-card)', overflow: 'hidden', opacity: dim ? 0.6 : 1 }}>
        {tasks.map((task, i) => (
          <div
            key={task.id}
            style={{
              display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 16px',
              borderBottom: i < tasks.length - 1 ? '1px solid var(--border)' : 'none',
              cursor: toggling.has(task.id) ? 'wait' : 'pointer',
            }}
            onClick={() => onToggle(task)}
          >
            <div style={{
              width: 20, height: 20, borderRadius: 5, flexShrink: 0, marginTop: 1,
              border: task.done ? 'none' : '2px solid var(--border-strong)',
              background: task.done ? '#10B981' : 'transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {task.done && (
                <svg viewBox="0 0 12 12" fill="none" width="10" height="10">
                  <path d="M2 6l3 3 5-5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-1)', margin: '0 0 2px', textDecoration: task.done ? 'line-through' : 'none' }}>
                {task.title}
              </p>
              {task.description && (
                <p style={{ fontSize: 12, color: 'var(--text-2)', margin: '0 0 4px' }}>{task.description}</p>
              )}
              <span style={{ fontSize: 11, fontWeight: 600, color: PRIORITY_COLOR[task.priority] }}>
                {PRIORITY_LABEL[task.priority]}
              </span>
            </div>
          </div>
        ))}
      </div>
    </>
  )
}
