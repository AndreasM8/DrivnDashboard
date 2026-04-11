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
    <div style={{
      position: 'fixed', inset: 0, zIndex: 50,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 16, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)',
    }}>
      <div className="modal-enter" style={{
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border-strong)',
        borderRadius: 'var(--radius-panel)',
        boxShadow: 'var(--shadow-dropdown)',
        width: '100%', maxWidth: 380, padding: 24,
      }}>
        <h2 className="section-title" style={{ marginBottom: 4 }}>Book the call</h2>
        <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 20 }}>
          When is <span style={{ fontFamily: 'var(--font-mono)' }}>@{lead.ig_username}</span>&apos;s call?
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-2)', marginBottom: 6 }}>Date</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} className="input-base" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-2)', marginBottom: 6 }}>Time</label>
              <input type="time" value={time} onChange={e => setTime(e.target.value)} className="input-base" />
            </div>
          </div>

          {setters.length > 0 && (
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-2)', marginBottom: 6 }}>Who&apos;s closing?</label>
              <select value={closerId} onChange={e => setCloserId(e.target.value)} className="input-base">
                {setters.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <button onClick={onClose} className="btn-ghost" style={{ flex: 1, justifyContent: 'center', padding: '10px' }}>
            Cancel
          </button>
          <button onClick={handleSave} disabled={loading} className="btn-primary" style={{ flex: 1, justifyContent: 'center', padding: '10px' }}>
            {loading ? 'Saving…' : 'Book call'}
          </button>
        </div>
      </div>
    </div>
  )
}
