'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import type { LeadLabel } from '@/types'

interface Props {
  userId: string
  labels: LeadLabel[]
  onClose: () => void
  onAdded: (label: LeadLabel) => void
  onRemoved: (labelId: string) => void
}

const PRESET_COLORS = [
  { bg: '#FAEEDA', text: '#633806' },
  { bg: '#E6F1FB', text: '#0C447C' },
  { bg: '#EAF3DE', text: '#27500A' },
  { bg: '#FCEBEB', text: '#791F1F' },
  { bg: '#EEEDFE', text: '#3C3489' },
  { bg: '#E1F5EE', text: '#085041' },
  { bg: '#FEF3C7', text: '#92400E' },
  { bg: '#F3F4F6', text: '#374151' },
]

export default function LabelManager({ userId, labels, onClose, onAdded, onRemoved }: Props) {
  const [name, setName] = useState('')
  const [colorIdx, setColorIdx] = useState(0)
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  async function addLabel() {
    if (!name.trim()) return
    setLoading(true)
    const color = PRESET_COLORS[colorIdx]
    const { data } = await supabase.from('lead_labels').insert({
      user_id: userId,
      name: name.trim(),
      bg_color: color.bg,
      text_color: color.text,
    }).select().single()

    if (data) {
      onAdded(data as LeadLabel)
      setName('')
    }
    setLoading(false)
  }

  async function removeLabel(labelId: string) {
    await supabase.from('lead_labels').delete().eq('id', labelId)
    onRemoved(labelId)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-gray-900">Labels</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        {/* Existing labels */}
        <div className="space-y-2 mb-5">
          {labels.length === 0 && (
            <p className="text-sm text-gray-400">No labels yet. Create one below.</p>
          )}
          {labels.map(l => (
            <div key={l.id} className="flex items-center gap-3">
              <span
                className="px-3 py-1 rounded-full text-xs font-medium flex-1"
                style={{ background: l.bg_color, color: l.text_color }}
              >
                {l.name}
              </span>
              <button
                onClick={() => removeLabel(l.id)}
                className="text-gray-300 hover:text-red-500 transition-colors"
              >
                <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                  <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          ))}
        </div>

        {/* Add new */}
        <div className="border-t border-gray-100 pt-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Create new label</p>

          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Label name"
            className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
            onKeyDown={e => e.key === 'Enter' && addLabel()}
          />

          <div className="flex gap-2 mb-4">
            {PRESET_COLORS.map((c, i) => (
              <button
                key={i}
                onClick={() => setColorIdx(i)}
                className={`w-7 h-7 rounded-full border-2 transition-all ${colorIdx === i ? 'border-gray-500 scale-110' : 'border-transparent'}`}
                style={{ background: c.bg }}
              />
            ))}
          </div>

          {name && (
            <div className="mb-3">
              <span
                className="px-3 py-1 rounded-full text-xs font-medium"
                style={{ background: PRESET_COLORS[colorIdx].bg, color: PRESET_COLORS[colorIdx].text }}
              >
                {name}
              </span>
            </div>
          )}

          <button
            onClick={addLabel}
            disabled={loading || !name.trim()}
            className="w-full py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-40 transition-colors"
          >
            {loading ? 'Adding…' : 'Add label'}
          </button>
        </div>
      </div>
    </div>
  )
}
