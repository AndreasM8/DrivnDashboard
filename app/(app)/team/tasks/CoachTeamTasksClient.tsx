'use client'

import { useState } from 'react'
import type { TeamMember, TeamTask } from '@/types'

type MemberStub = Pick<TeamMember, 'id' | 'name' | 'role'>

interface Props {
  initialTasks: TeamTask[]
  members: MemberStub[]
}

const PRIORITY_LABEL: Record<TeamTask['priority'], string> = {
  today: 'Today', this_week: 'This week', later: 'Later',
}
const PRIORITY_COLOR: Record<TeamTask['priority'], string> = {
  today: '#EF4444', this_week: '#F59E0B', later: 'var(--text-3)',
}

export default function CoachTeamTasksClient({ initialTasks, members }: Props) {
  const [tasks, setTasks] = useState<TeamTask[]>(initialTasks)
  const [newTitle, setNewTitle] = useState('')
  const [newPriority, setNewPriority] = useState<TeamTask['priority']>('this_week')
  const [newAssignee, setNewAssignee] = useState('')
  const [filter, setFilter] = useState<string>('all')
  const [adding, setAdding] = useState(false)

  async function addTask(e: React.FormEvent) {
    e.preventDefault()
    if (!newTitle.trim() || adding) return
    setAdding(true)
    try {
      const res = await fetch('/api/team/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTitle.trim(),
          priority: newPriority,
          assigned_to: newAssignee || null,
        }),
      })
      if (res.ok) {
        const data = await res.json() as { task: TeamTask }
        setTasks(prev => [data.task, ...prev])
        setNewTitle('')
      }
    } finally {
      setAdding(false)
    }
  }

  async function toggleDone(task: TeamTask) {
    const res = await fetch(`/api/team/tasks/${task.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ done: !task.done }),
    })
    if (res.ok) {
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, done: !t.done } : t))
    }
  }

  const filtered = filter === 'all'
    ? tasks
    : tasks.filter(t => t.assigned_to === filter)

  const open = filtered.filter(t => !t.done)
  const done = filtered.filter(t => t.done)

  return (
    <div style={{ maxWidth: 680, margin: '0 auto', padding: 24 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-1)', margin: '0 0 4px' }}>Team Tasks</h1>
        <p style={{ fontSize: 14, color: 'var(--text-2)', margin: 0 }}>
          Assign tasks to your setters and closers
        </p>
      </div>

      {/* Add task */}
      <form onSubmit={addTask} style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        <input
          value={newTitle} onChange={e => setNewTitle(e.target.value)}
          placeholder="Add a task…"
          style={{ flex: '1 1 200px', padding: '10px 14px', background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 14, color: 'var(--text-1)', outline: 'none' }}
        />
        <select
          value={newPriority} onChange={e => setNewPriority(e.target.value as TeamTask['priority'])}
          style={{ padding: '10px 10px', background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, color: 'var(--text-1)', cursor: 'pointer' }}
        >
          <option value="today">Today</option>
          <option value="this_week">This week</option>
          <option value="later">Later</option>
        </select>
        <select
          value={newAssignee} onChange={e => setNewAssignee(e.target.value)}
          style={{ padding: '10px 10px', background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, color: 'var(--text-1)', cursor: 'pointer' }}
        >
          <option value="">All team</option>
          {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
        <button
          type="submit" disabled={!newTitle.trim() || adding}
          style={{ padding: '10px 18px', background: '#2563EB', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: !newTitle.trim() || adding ? 'not-allowed' : 'pointer', opacity: !newTitle.trim() || adding ? 0.6 : 1 }}
        >
          Add
        </button>
      </form>

      {/* Filter by member */}
      {members.length > 0 && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
          <FilterChip label="All" active={filter === 'all'} onClick={() => setFilter('all')} />
          {members.map(m => (
            <FilterChip key={m.id} label={m.name} active={filter === m.id} onClick={() => setFilter(m.id)} />
          ))}
        </div>
      )}

      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 48, background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: 'var(--radius-card)' }}>
          <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-1)', marginBottom: 4 }}>No tasks yet</p>
          <p style={{ fontSize: 13, color: 'var(--text-2)', margin: 0 }}>Add tasks above and assign them to your team.</p>
        </div>
      ) : (
        <>
          {open.length > 0 && <TaskGroup tasks={open} members={members} onToggle={toggleDone} title="Open" />}
          {done.length > 0 && <div style={{ marginTop: 16 }}><TaskGroup tasks={done} members={members} onToggle={toggleDone} title="Done" dim /></div>}
        </>
      )}
    </div>
  )
}

function FilterChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 500,
        border: '1px solid', cursor: 'pointer',
        borderColor: active ? 'var(--accent)' : 'var(--border)',
        background: active ? 'rgba(37,99,235,0.08)' : 'transparent',
        color: active ? 'var(--accent)' : 'var(--text-2)',
        transition: 'all 120ms',
      }}
    >
      {label}
    </button>
  )
}

function TaskGroup({
  tasks, members, onToggle, title, dim,
}: {
  tasks: TeamTask[]
  members: MemberStub[]
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
        {tasks.map((task, i) => {
          const assignee = members.find(m => m.id === task.assigned_to)
          return (
            <div
              key={task.id}
              style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '11px 14px', borderBottom: i < tasks.length - 1 ? '1px solid var(--border)' : 'none', cursor: 'pointer' }}
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
                <p style={{ fontSize: 14, color: 'var(--text-1)', margin: '0 0 3px', textDecoration: task.done ? 'line-through' : 'none' }}>
                  {task.title}
                </p>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: PRIORITY_COLOR[task.priority] }}>
                    {PRIORITY_LABEL[task.priority]}
                  </span>
                  {assignee && (
                    <span style={{ fontSize: 11, color: 'var(--text-3)' }}>→ {assignee.name}</span>
                  )}
                  {!assignee && (
                    <span style={{ fontSize: 11, color: 'var(--text-3)' }}>All team</span>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}
