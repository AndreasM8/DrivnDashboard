'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import type { Task, TaskType, TaskPriority } from '@/types'

interface Props {
  userId: string
  onClose: () => void
  onAdded: (task: Task) => void
}

type ReminderUnit = 'minutes' | 'hours' | 'days'

function computeReminderAt(dueAt: string, amount: number, unit: ReminderUnit): string {
  const due = new Date(dueAt)
  const ms = unit === 'minutes' ? amount * 60_000
           : unit === 'hours'   ? amount * 3_600_000
           :                      amount * 86_400_000
  return new Date(due.getTime() - ms).toISOString()
}

export default function AddTaskModal({ userId, onClose, onAdded }: Props) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [type, setType] = useState<TaskType>('manual')
  const [priority, setPriority] = useState<TaskPriority>('today')
  const [dueAt, setDueAt] = useState(new Date().toISOString().slice(0, 10))
  const [reminderEnabled, setReminderEnabled] = useState(false)
  const [reminderAmount, setReminderAmount] = useState(1)
  const [reminderUnit, setReminderUnit] = useState<ReminderUnit>('hours')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title) return
    setLoading(true)
    setError('')

    const dueIso = new Date(dueAt).toISOString()
    const reminderAt = reminderEnabled && reminderAmount > 0
      ? computeReminderAt(dueIso, reminderAmount, reminderUnit)
      : null

    const supabase = createClient()
    const { data, error: err } = await supabase.from('tasks').insert({
      user_id: userId,
      type,
      priority,
      title,
      description,
      due_at: dueIso,
      reminder_at: reminderAt,
      auto_generated: false,
    }).select().single()

    if (err) { setError('Something went wrong. Please try again.'); setLoading(false); return }
    if (data) onAdded(data as Task)
    setLoading(false)
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 50,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 16, background: 'rgba(0,0,0,0.4)',
    }}>
      <div className="modal-enter" style={{
        background: 'var(--surface-1)',
        borderRadius: 'var(--radius-panel)',
        boxShadow: 'var(--shadow-dropdown)',
        width: '100%', maxWidth: 440, padding: 24,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h2 className="section-title">Add task</h2>
          <button
            onClick={onClose}
            style={{ color: 'var(--text-3)', background: 'none', border: 'none', cursor: 'pointer', padding: 4, lineHeight: 0, transition: 'color 120ms ease' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-1)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-3)')}
          >
            <svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-2)', marginBottom: 6 }}>Task title *</label>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="What needs to be done?" required className="input-base" />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-2)', marginBottom: 6 }}>Description</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Any extra context…"
              rows={2}
              className="input-base"
              style={{ resize: 'none' }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-2)', marginBottom: 6 }}>Type</label>
              <select value={type} onChange={e => setType(e.target.value as TaskType)} className="input-base">
                <option value="manual">General</option>
                <option value="follow_up">Follow-up</option>
                <option value="nurture">Nurture</option>
                <option value="upsell">Upsell</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-2)', marginBottom: 6 }}>Priority</label>
              <select value={priority} onChange={e => setPriority(e.target.value as TaskPriority)} className="input-base">
                <option value="overdue">Overdue</option>
                <option value="today">Today</option>
                <option value="this_week">This week</option>
                <option value="upcoming">Coming up</option>
              </select>
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-2)', marginBottom: 6 }}>Due date</label>
            <input type="date" value={dueAt.slice(0, 10)} onChange={e => setDueAt(e.target.value)} className="input-base" />
          </div>

          {/* Reminder toggle */}
          <div style={{
            borderRadius: 'var(--radius-card)',
            border: '1px solid var(--border)',
            overflow: 'hidden',
          }}>
            <button
              type="button"
              onClick={() => setReminderEnabled(v => !v)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '12px 16px', background: 'none', border: 'none', cursor: 'pointer',
                transition: 'background 120ms ease',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-2)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'none')}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16"
                  style={{ color: reminderEnabled ? 'var(--accent)' : 'var(--text-3)', transition: 'color 120ms ease' }}>
                  <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zm0 16a2 2 0 01-2-2h4a2 2 0 01-2 2z" />
                </svg>
                <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-1)' }}>Remind me before</span>
              </div>
              {/* Toggle */}
              <div style={{
                position: 'relative', width: 36, height: 20, borderRadius: 10,
                background: reminderEnabled ? 'var(--accent)' : 'var(--surface-3)',
                transition: 'background 150ms ease', flexShrink: 0,
              }}>
                <span style={{
                  position: 'absolute', top: 3, width: 14, height: 14, borderRadius: '50%',
                  background: '#fff', boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
                  transition: 'transform 150ms ease',
                  transform: reminderEnabled ? 'translateX(18px)' : 'translateX(3px)',
                }} />
              </div>
            </button>

            {reminderEnabled && (
              <div style={{
                padding: '8px 16px 14px',
                background: 'var(--surface-2)',
                borderTop: '1px solid var(--border)',
              }}>
                <p style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 10 }}>Reminder will appear in your task list</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input
                    type="number"
                    min={1}
                    max={reminderUnit === 'minutes' ? 59 : reminderUnit === 'hours' ? 23 : 30}
                    value={reminderAmount}
                    onChange={e => setReminderAmount(Math.max(1, parseInt(e.target.value) || 1))}
                    className="input-base"
                    style={{ width: 72, textAlign: 'center', fontWeight: 600 }}
                  />
                  <select
                    value={reminderUnit}
                    onChange={e => setReminderUnit(e.target.value as ReminderUnit)}
                    className="input-base"
                    style={{ flex: 1 }}
                  >
                    <option value="minutes">minutes before</option>
                    <option value="hours">hours before</option>
                    <option value="days">days before</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          {error && <p style={{ fontSize: 12, color: 'var(--danger)' }}>{error}</p>}

          <div style={{ display: 'flex', gap: 10, paddingTop: 4 }}>
            <button type="button" onClick={onClose} className="btn-ghost" style={{ flex: 1, justifyContent: 'center', padding: '10px' }}>
              Cancel
            </button>
            <button type="submit" disabled={loading || !title} className="btn-primary" style={{ flex: 1, justifyContent: 'center', padding: '10px' }}>
              {loading ? 'Adding…' : 'Add task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
