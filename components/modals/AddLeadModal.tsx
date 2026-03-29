'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { triggerSheetsSync } from '@/lib/sync-sheets-client'
import type { Lead, LeadStage, Setter } from '@/types'

interface Props {
  userId: string
  defaultStage: LeadStage
  setters: Setter[]
  onClose: () => void
  onAdded: (lead: Lead) => void
}

export default function AddLeadModal({ userId, defaultStage, setters, onClose, onAdded }: Props) {
  const [igUsername, setIgUsername] = useState('')
  const [fullName, setFullName] = useState('')
  const [setterId, setSetterId] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!igUsername) return
    setLoading(true)
    setError('')

    const supabase = createClient()
    const { data, error: err } = await supabase
      .from('leads')
      .insert({
        user_id: userId,
        ig_username: igUsername.replace('@', ''),
        full_name: fullName,
        stage: defaultStage,
        setter_id: setterId || null,
        setter_notes: notes,
        last_contact_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (err) { setError('Something went wrong. Please try again.'); setLoading(false); return }
    if (data) {
      await supabase.from('lead_history').insert({
        lead_id: data.id,
        action: 'Lead added manually',
        actor: 'You',
      })
      onAdded(data as Lead)
      triggerSheetsSync()
    }
    setLoading(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-gray-900">Add follower to pipeline</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Instagram username *</label>
            <input
              value={igUsername}
              onChange={e => setIgUsername(e.target.value)}
              placeholder="@username"
              required
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Full name</label>
            <input
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              placeholder="Jane Smith"
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {setters.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Assigned setter</label>
              <select
                value={setterId}
                onChange={e => setSetterId(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Unassigned</option>
                {setters.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Their vibe, goal, what content they reacted to…"
              rows={3}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !igUsername}
              className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Adding…' : 'Add to pipeline'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
