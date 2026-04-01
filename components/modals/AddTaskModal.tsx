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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-gray-900 dark:text-slate-100">Add task</h2>
          <button onClick={onClose} className="text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300 transition-colors">
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Task title *</label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="What needs to be done?"
              required
              className="w-full px-3 py-2.5 border border-gray-200 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Description</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Any extra context…"
              rows={2}
              className="w-full px-3 py-2.5 border border-gray-200 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Type</label>
              <select
                value={type}
                onChange={e => setType(e.target.value as TaskType)}
                className="w-full px-3 py-2.5 border border-gray-200 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="manual">General</option>
                <option value="follow_up">Follow-up</option>
                <option value="nurture">Nurture</option>
                <option value="upsell">Upsell</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Priority</label>
              <select
                value={priority}
                onChange={e => setPriority(e.target.value as TaskPriority)}
                className="w-full px-3 py-2.5 border border-gray-200 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="overdue">Overdue</option>
                <option value="today">Today</option>
                <option value="this_week">This week</option>
                <option value="upcoming">Coming up</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Due date</label>
            <input
              type="date"
              value={dueAt.slice(0, 10)}
              onChange={e => setDueAt(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-200 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* ── Reminder toggle ── */}
          <div className="rounded-xl border border-gray-100 dark:border-slate-700 overflow-hidden">
            <button
              type="button"
              onClick={() => setReminderEnabled(v => !v)}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <svg viewBox="0 0 20 20" fill="currentColor" className={`w-4 h-4 transition-colors ${reminderEnabled ? 'text-blue-500' : 'text-gray-400 dark:text-slate-500'}`}>
                  <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zm0 16a2 2 0 01-2-2h4a2 2 0 01-2 2z" />
                </svg>
                <span className="text-sm font-medium text-gray-700 dark:text-slate-300">Remind me before</span>
              </div>
              {/* Toggle pill */}
              <div className={`relative w-9 h-5 rounded-full transition-colors ${reminderEnabled ? 'bg-blue-500' : 'bg-gray-200 dark:bg-slate-600'}`}>
                <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${reminderEnabled ? 'translate-x-4' : 'translate-x-0'}`} />
              </div>
            </button>

            {reminderEnabled && (
              <div className="px-4 pb-4 pt-1 bg-gray-50 dark:bg-slate-700/30 border-t border-gray-100 dark:border-slate-700">
                <p className="text-xs text-gray-500 dark:text-slate-400 mb-2.5">Reminder will appear in your task list</p>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    max={reminderUnit === 'minutes' ? 59 : reminderUnit === 'hours' ? 23 : 30}
                    value={reminderAmount}
                    onChange={e => setReminderAmount(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-20 px-3 py-2 border border-gray-200 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 text-center"
                  />
                  <select
                    value={reminderUnit}
                    onChange={e => setReminderUnit(e.target.value as ReminderUnit)}
                    className="flex-1 px-3 py-2 border border-gray-200 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="minutes">minutes before</option>
                    <option value="hours">hours before</option>
                    <option value="days">days before</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 border border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-300 rounded-xl text-sm font-medium hover:bg-gray-50 dark:hover:bg-slate-700">Cancel</button>
            <button type="submit" disabled={loading || !title} className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
              {loading ? 'Adding…' : 'Add task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
