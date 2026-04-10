'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { triggerSheetsSync } from '@/lib/sync-sheets-client'
import type { Lead, LeadStage, Setter } from '@/types'
import { useT } from '@/contexts/LanguageContext'

interface Props {
  userId: string
  defaultStage: LeadStage
  setters: Setter[]
  existingLeads: Lead[]
  onClose: () => void
  onAdded: (lead: Lead) => void
}

export default function AddLeadModal({ userId, defaultStage, setters, existingLeads, onClose, onAdded }: Props) {
  const t = useT()
  const [igUsername, setIgUsername] = useState('')
  const [fullName, setFullName] = useState('')
  const [setterId, setSetterId] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const isDuplicate = igUsername.length > 0 &&
    existingLeads.some(l => l.ig_username.toLowerCase() === igUsername.replace('@', '').toLowerCase())

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
          <h2 className="section-title">{t.pipeline.addLead}</h2>
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
            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-2)', marginBottom: 6 }}>
              Instagram username *
            </label>
            <input
              value={igUsername}
              onChange={e => setIgUsername(e.target.value)}
              placeholder="@username"
              required
              className="input-base"
              style={{ fontFamily: igUsername ? 'var(--font-mono)' : undefined }}
            />
            {isDuplicate && (
              <p style={{ marginTop: 6, fontSize: 12, color: 'var(--warning)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14" style={{ flexShrink: 0 }}>
                  <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                </svg>
                A lead with this username already exists. You can still add them.
              </p>
            )}
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-2)', marginBottom: 6 }}>Full name</label>
            <input value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Jane Smith" className="input-base" />
          </div>

          {setters.length > 0 && (
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-2)', marginBottom: 6 }}>Assigned setter</label>
              <select value={setterId} onChange={e => setSetterId(e.target.value)} className="input-base">
                <option value="">Unassigned</option>
                {setters.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          )}

          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-2)', marginBottom: 6 }}>Notes</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Their vibe, goal, what content they reacted to…"
              rows={3}
              className="input-base"
              style={{ resize: 'none' }}
            />
          </div>

          {error && <p style={{ fontSize: 12, color: 'var(--danger)' }}>{error}</p>}

          <div style={{ display: 'flex', gap: 10, paddingTop: 4 }}>
            <button type="button" onClick={onClose} className="btn-ghost" style={{ flex: 1, justifyContent: 'center', padding: '10px' }}>
              {t.common.cancel}
            </button>
            <button type="submit" disabled={loading || !igUsername} className="btn-primary" style={{ flex: 1, justifyContent: 'center', padding: '10px' }}>
              {loading ? 'Adding…' : t.pipeline.addLead}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
