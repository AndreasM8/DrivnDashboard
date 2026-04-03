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
    <div style={{
      position: 'fixed', inset: 0, zIndex: 50,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 16, background: 'rgba(0,0,0,0.4)',
    }}>
      <div style={{
        background: 'var(--surface-1)',
        borderRadius: 'var(--radius-panel)',
        boxShadow: 'var(--shadow-dropdown)',
        width: '100%', maxWidth: 360, padding: 24,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h2 className="section-title">Labels</h2>
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

        {/* Existing labels */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
          {labels.length === 0 && (
            <p style={{ fontSize: 13, color: 'var(--text-3)' }}>No labels yet. Create one below.</p>
          )}
          {labels.map(l => (
            <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span
                className="badge"
                style={{ background: l.bg_color, color: l.text_color, flex: 1 }}
              >
                {l.name}
              </span>
              <button
                onClick={() => removeLabel(l.id)}
                style={{ color: 'var(--border-strong)', background: 'none', border: 'none', cursor: 'pointer', padding: 2, lineHeight: 0, transition: 'color 120ms ease', flexShrink: 0 }}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--danger)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'var(--border-strong)')}
              >
                <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
                  <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          ))}
        </div>

        {/* Add new */}
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
          <p className="label-caps" style={{ marginBottom: 12 }}>Create new label</p>

          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Label name"
            className="input-base"
            style={{ marginBottom: 12 }}
            onKeyDown={e => e.key === 'Enter' && addLabel()}
          />

          <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
            {PRESET_COLORS.map((c, i) => (
              <button
                key={i}
                onClick={() => setColorIdx(i)}
                style={{
                  width: 28, height: 28, borderRadius: '50%',
                  background: c.bg,
                  border: colorIdx === i ? '2px solid var(--text-2)' : '2px solid transparent',
                  cursor: 'pointer',
                  transform: colorIdx === i ? 'scale(1.15)' : 'scale(1)',
                  transition: 'transform 120ms ease, border-color 120ms ease',
                  flexShrink: 0,
                }}
              />
            ))}
          </div>

          {name && (
            <div style={{ marginBottom: 12 }}>
              <span className="badge" style={{ background: PRESET_COLORS[colorIdx].bg, color: PRESET_COLORS[colorIdx].text }}>
                {name}
              </span>
            </div>
          )}

          <button
            onClick={addLabel}
            disabled={loading || !name.trim()}
            className="btn-primary"
            style={{ width: '100%', justifyContent: 'center', padding: '10px' }}
          >
            {loading ? 'Adding…' : 'Add label'}
          </button>
        </div>
      </div>
    </div>
  )
}
