'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import type { Lead, Setter } from '@/types'

interface Props {
  lead: Lead
  setters: Setter[]
  onClose: () => void
  onSaved: (updated: Lead) => void
}

export default function CallBookedModal({ lead, setters, onClose, onSaved }: Props) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [time, setTime] = useState('10:00')
  const [closerId, setCloserId] = useState(setters[0]?.id ?? '')
  const [loading, setLoading] = useState(false)

  async function handleSave() {
    setLoading(true)
    const callBookedAt = new Date(`${date}T${time}`).toISOString()
    const supabase = createClient()

    const { data, error } = await supabase
      .from('leads')
      .update({
        stage: 'call_booked',
        call_booked_at: callBookedAt,
        closer_id: closerId || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', lead.id)
      .select()
      .single()

    if (!error && data) {
      await supabase.from('lead_history').insert({
        lead_id: lead.id,
        action: `Call booked for ${new Date(callBookedAt).toLocaleString('en', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`,
        actor: 'You',
      })

      // Create a "log outcome" reminder task due 2 hrs after the call
      const callDate = new Date(callBookedAt)
      await supabase.from('tasks').insert({
        user_id: lead.user_id,
        type: 'call_outcome',
        priority: 'today',
        title: `Log outcome — @${lead.ig_username}`,
        description: `Call at ${callDate.toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' })}`,
        lead_id: lead.id,
        due_at: new Date(callDate.getTime() + 2 * 60 * 60 * 1000).toISOString(),
        auto_generated: true,
      })

      onSaved(data as Lead)
    }
    setLoading(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-sm p-6">
        <h2 className="text-lg font-bold text-gray-900 dark:text-slate-100 mb-1">Book the call</h2>
        <p className="text-sm text-gray-500 dark:text-slate-400 mb-5">When is @{lead.ig_username}&apos;s call?</p>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Date</label>
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-200 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Time</label>
              <input
                type="time"
                value={time}
                onChange={e => setTime(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-200 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {setters.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Who&apos;s closing?</label>
              <select
                value={closerId}
                onChange={e => setCloserId(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-200 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {setters.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          )}
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 border border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-400 rounded-xl text-sm font-medium hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={loading}
            className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Saving…' : 'Book call'}
          </button>
        </div>
      </div>
    </div>
  )
}
