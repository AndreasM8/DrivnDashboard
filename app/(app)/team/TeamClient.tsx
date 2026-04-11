'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { TeamMember, TeamRole, TeamMemberStatus, TeamPermissions, CheckinQuestion, CheckinQuestionType } from '@/types'
import TeamDashboard from './TeamDashboard'

interface Props {
  userId: string
  initialMembers: TeamMember[]
}

const ROLE_LABELS: Record<TeamRole, string> = {
  setter: 'Setter',
  closer: 'Closer',
}

const STATUS_COLORS: Record<TeamMemberStatus, { bg: string; text: string }> = {
  invited:  { bg: 'rgba(245,158,11,0.12)',  text: '#F59E0B' },
  active:   { bg: 'rgba(16,185,129,0.12)',  text: '#10B981' },
  inactive: { bg: 'rgba(100,116,139,0.12)', text: '#64748B' },
}

const PERM_KEYS: (keyof TeamPermissions)[] = ['pipeline', 'clients', 'finances', 'labels', 'content']
const PERM_LABELS: Record<keyof TeamPermissions, string> = {
  pipeline: 'Pipeline', clients: 'Clients', finances: 'Finances', labels: 'Labels', content: 'Content',
}

const Q_TYPE_LABELS: Record<CheckinQuestionType, string> = {
  number: 'Number', text: 'Short answer', textarea: 'Long answer', boolean: 'Yes / No',
}

// ─── Add Member Modal ─────────────────────────────────────────────────────────

interface InviteResult {
  member: TeamMember
  invite_url: string
}

function AddMemberModal({ onClose, onAdded }: { onClose: () => void; onAdded: (m: TeamMember) => void }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<TeamRole>('setter')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [inviteUrl, setInviteUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (loading) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/team/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, role }),
      })
      const data = await res.json() as InviteResult & { error?: string }
      if (!res.ok) { setError(data.error ?? 'Something went wrong'); return }
      setInviteUrl(data.invite_url)
      onAdded(data.member)
    } finally {
      setLoading(false)
    }
  }

  function copyLink() {
    if (!inviteUrl) return
    navigator.clipboard.writeText(inviteUrl).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: 'rgba(0,0,0,0.5)' }}>
      <div style={{ background: 'var(--surface-1)', borderRadius: 20, padding: 28, width: '100%', maxWidth: 440, border: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-1)', margin: 0 }}>Add team member</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-2)', padding: 4 }}>
            <svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        {inviteUrl ? (
          <div>
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>🔗</div>
              <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-1)', margin: '0 0 4px' }}>Invite link created!</p>
              <p style={{ fontSize: 13, color: 'var(--text-2)', margin: 0 }}>Share this link with {name}</p>
            </div>
            <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px', marginBottom: 12, wordBreak: 'break-all', fontSize: 12, color: 'var(--text-2)' }}>
              {inviteUrl}
            </div>
            <button
              onClick={copyLink}
              style={{
                width: '100%', padding: '11px 20px',
                background: copied ? '#10B981' : '#2563EB',
                color: '#fff', border: 'none', borderRadius: 10,
                fontSize: 14, fontWeight: 600, cursor: 'pointer', marginBottom: 8,
              }}
            >
              {copied ? 'Copied!' : 'Copy invite link'}
            </button>
            <p style={{ fontSize: 11, color: 'var(--text-3)', textAlign: 'center', margin: 0 }}>
              Link expires in 7 days
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <Field label="Name">
                <input
                  value={name} onChange={e => setName(e.target.value)} required
                  placeholder="Alex Smith"
                  style={inputStyle}
                />
              </Field>
              <Field label="Email">
                <input
                  type="email" value={email} onChange={e => setEmail(e.target.value)} required
                  placeholder="alex@example.com"
                  style={inputStyle}
                />
              </Field>
              <Field label="Role">
                <div style={{ display: 'flex', gap: 8 }}>
                  {(['setter', 'closer'] as TeamRole[]).map(r => (
                    <button
                      key={r} type="button"
                      onClick={() => setRole(r)}
                      style={{
                        flex: 1, padding: '9px 0', borderRadius: 8, fontSize: 13, fontWeight: 600,
                        cursor: 'pointer', border: '2px solid',
                        borderColor: role === r ? 'var(--accent)' : 'var(--border)',
                        background: role === r ? 'rgba(37,99,235,0.08)' : 'transparent',
                        color: role === r ? 'var(--accent)' : 'var(--text-2)',
                        transition: 'all 120ms',
                      }}
                    >
                      {ROLE_LABELS[r]}
                    </button>
                  ))}
                </div>
              </Field>
            </div>
            {error && (
              <div style={{ marginTop: 12, background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.2)', borderRadius: 8, padding: '8px 12px', fontSize: 13, color: '#EF4444' }}>
                {error}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
              <button type="button" onClick={onClose} style={{ flex: 1, padding: '10px 0', border: '1px solid var(--border)', borderRadius: 10, fontSize: 14, color: 'var(--text-2)', background: 'transparent', cursor: 'pointer' }}>
                Cancel
              </button>
              <button type="submit" disabled={loading} style={{ flex: 1, padding: '10px 0', background: '#2563EB', color: '#fff', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}>
                {loading ? 'Creating…' : 'Create invite'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

// ─── Member Card with expanded view ──────────────────────────────────────────

const DAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

function MemberCard({ member }: { member: TeamMember }) {
  const [expanded, setExpanded] = useState(false)
  const [questions, setQuestions] = useState<CheckinQuestion[]>([])
  const [eodHour, setEodHour] = useState(20)
  const [loadingTemplate, setLoadingTemplate] = useState(false)
  const [savingTemplate, setSavingTemplate] = useState(false)
  const [savingWeekly, setSavingWeekly] = useState(false)
  const [nonNegs, setNonNegs] = useState<Array<{ id: string; title: string; order_index: number }>>([])
  const [newNonNeg, setNewNonNeg] = useState('')
  const [loadedDetail, setLoadedDetail] = useState(false)
  // Weekly check-in state
  const [weeklyQuestions, setWeeklyQuestions] = useState<CheckinQuestion[]>([])
  const [weeklyEnabled, setWeeklyEnabled] = useState(false)
  const [weeklyDay, setWeeklyDay] = useState(1)
  // Invite link state
  const [inviteToken, setInviteToken] = useState<string>(member.invite_token ?? '')
  const [inviteCopied, setInviteCopied] = useState(false)
  const [regenerating, setRegenerating] = useState(false)
  const [showReInvite, setShowReInvite] = useState(false)

  const statusStyle = STATUS_COLORS[member.status] ?? STATUS_COLORS.inactive
  const inviteUrl = `${APP_URL}/join/${inviteToken}`

  async function loadDetail() {
    if (loadedDetail) return
    setLoadingTemplate(true)
    try {
      const [tplRes, weeklyTplRes, nnRes] = await Promise.all([
        fetch(`/api/team/members/${member.id}/template?type=eod`),
        fetch(`/api/team/members/${member.id}/template?type=weekly`),
        fetch(`/api/team/members/${member.id}/non-negotiables`),
      ])
      const tplData = await tplRes.json() as { template: { questions: CheckinQuestion[]; eod_hour?: number } | null }
      const weeklyTplData = await weeklyTplRes.json() as { template: { questions: CheckinQuestion[]; weekly_enabled?: boolean; weekly_day?: number } | null }
      const nnData = await nnRes.json() as { non_negs: Array<{ id: string; title: string; order_index: number }> }
      setQuestions(tplData.template?.questions ?? [])
      setEodHour(tplData.template?.eod_hour ?? 20)
      setWeeklyQuestions(weeklyTplData.template?.questions ?? [])
      setWeeklyEnabled(weeklyTplData.template?.weekly_enabled ?? false)
      setWeeklyDay(weeklyTplData.template?.weekly_day ?? 1)
      setNonNegs(nnData.non_negs ?? [])
      setLoadedDetail(true)
    } finally {
      setLoadingTemplate(false)
    }
  }

  function toggleExpand() {
    if (!expanded) loadDetail()
    setExpanded(e => !e)
  }

  async function saveTemplate() {
    setSavingTemplate(true)
    await fetch(`/api/team/members/${member.id}/template`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'eod', questions, eod_hour: eodHour }),
    })
    setSavingTemplate(false)
  }

  async function saveWeeklyTemplate() {
    setSavingWeekly(true)
    await fetch(`/api/team/members/${member.id}/template`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'weekly', questions: weeklyQuestions, weekly_enabled: weeklyEnabled, weekly_day: weeklyDay }),
    })
    setSavingWeekly(false)
  }

  function addQuestion() {
    const id = `q${Date.now()}`
    setQuestions(prev => [...prev, { id, label: '', type: 'number', required: false }])
  }

  function removeQuestion(id: string) {
    setQuestions(prev => prev.filter(q => q.id !== id))
  }

  function updateQuestion(id: string, field: keyof CheckinQuestion, value: string | boolean | CheckinQuestionType) {
    setQuestions(prev => prev.map(q => q.id === id ? { ...q, [field]: value } : q))
  }

  function addWeeklyQuestion() {
    const id = `wq${Date.now()}`
    setWeeklyQuestions(prev => [...prev, { id, label: '', type: 'text', required: false }])
  }

  function removeWeeklyQuestion(id: string) {
    setWeeklyQuestions(prev => prev.filter(q => q.id !== id))
  }

  function updateWeeklyQuestion(id: string, field: keyof CheckinQuestion, value: string | boolean | CheckinQuestionType) {
    setWeeklyQuestions(prev => prev.map(q => q.id === id ? { ...q, [field]: value } : q))
  }

  async function addNonNeg() {
    if (!newNonNeg.trim()) return
    const res = await fetch(`/api/team/members/${member.id}/non-negotiables`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: newNonNeg.trim(), order_index: nonNegs.length }),
    })
    const data = await res.json() as { non_neg: { id: string; title: string; order_index: number } }
    setNonNegs(prev => [...prev, data.non_neg])
    setNewNonNeg('')
  }

  async function removeNonNeg(id: string) {
    await fetch(`/api/team/members/${member.id}/non-negotiables?non_neg_id=${id}`, { method: 'DELETE' })
    setNonNegs(prev => prev.filter(n => n.id !== id))
  }

  function copyInviteLink(url: string) {
    navigator.clipboard.writeText(url).then(() => {
      setInviteCopied(true)
      setTimeout(() => setInviteCopied(false), 2000)
    })
  }

  async function regenerateInvite() {
    setRegenerating(true)
    try {
      const res = await fetch('/api/team/invite/regenerate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ member_id: member.id }),
      })
      const data = await res.json() as { invite_token?: string; error?: string }
      if (data.invite_token) setInviteToken(data.invite_token)
    } finally {
      setRegenerating(false)
    }
  }

  return (
    <div style={{ background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: 'var(--radius-card)', overflow: 'hidden' }}>
      {/* Header row */}
      <div
        style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', cursor: 'pointer' }}
        onClick={toggleExpand}
      >
        <div style={{
          width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
          background: member.role === 'setter' ? 'rgba(124,58,237,0.12)' : 'rgba(37,99,235,0.12)',
          color: member.role === 'setter' ? '#7C3AED' : '#2563EB',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 14, fontWeight: 700,
        }}>
          {member.name.charAt(0).toUpperCase()}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-1)' }}>{member.name}</span>
            <span style={{
              fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 5,
              background: member.role === 'setter' ? 'rgba(124,58,237,0.12)' : 'rgba(37,99,235,0.12)',
              color: member.role === 'setter' ? '#7C3AED' : '#2563EB',
              textTransform: 'uppercase', letterSpacing: '0.06em',
            }}>
              {ROLE_LABELS[member.role]}
            </span>
            <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 7px', borderRadius: 5, background: statusStyle.bg, color: statusStyle.text }}>
              {member.status.charAt(0).toUpperCase() + member.status.slice(1)}
            </span>
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-2)', margin: 0 }}>{member.email}</p>
        </div>
        {/* Re-invite button for active members */}
        {member.status === 'active' && (
          <button
            onClick={e => { e.stopPropagation(); setShowReInvite(v => !v) }}
            style={{
              padding: '5px 10px', fontSize: 11, fontWeight: 600,
              border: '1px solid var(--border)', borderRadius: 7,
              background: 'transparent', color: 'var(--text-2)', cursor: 'pointer', flexShrink: 0,
            }}
          >
            Re-invite
          </button>
        )}
        <svg
          viewBox="0 0 20 20" fill="currentColor" width="16" height="16"
          style={{ flexShrink: 0, color: 'var(--text-3)', transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 200ms' }}
        >
          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
      </div>

      {/* Re-invite inline area for active members */}
      {member.status === 'active' && showReInvite && (
        <div style={{ borderTop: '1px solid var(--border)', padding: '12px 16px', background: 'rgba(37,99,235,0.04)' }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-2)', margin: '0 0 8px' }}>Re-invite link</p>
          <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', marginBottom: 8, wordBreak: 'break-all', fontSize: 11, color: 'var(--text-2)' }}>
            {inviteUrl}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => copyInviteLink(inviteUrl)}
              style={{ flex: 1, padding: '7px 0', background: inviteCopied ? '#10B981' : '#2563EB', color: '#fff', border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
            >
              {inviteCopied ? 'Copied!' : 'Copy link'}
            </button>
            <button
              onClick={regenerateInvite}
              disabled={regenerating}
              style={{ flex: 1, padding: '7px 0', border: '1px solid var(--border)', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: regenerating ? 'not-allowed' : 'pointer', background: 'transparent', color: 'var(--text-2)', opacity: regenerating ? 0.7 : 1 }}
            >
              {regenerating ? 'Regenerating…' : 'Regenerate link'}
            </button>
          </div>
        </div>
      )}

      {/* Expanded detail */}
      {expanded && (
        <div style={{ borderTop: '1px solid var(--border)', padding: 16, display: 'flex', flexDirection: 'column', gap: 20 }}>
          {loadingTemplate ? (
            <p style={{ fontSize: 13, color: 'var(--text-2)', textAlign: 'center' }}>Loading…</p>
          ) : (
            <>
              {/* Pending invite banner */}
              {member.status === 'invited' && (
                <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 10, padding: 14 }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: '#F59E0B', margin: '0 0 8px' }}>Pending invite</p>
                  <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', marginBottom: 10, wordBreak: 'break-all', fontSize: 11, color: 'var(--text-2)' }}>
                    {inviteUrl}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={() => copyInviteLink(inviteUrl)}
                      style={{ flex: 1, padding: '7px 0', background: inviteCopied ? '#10B981' : '#2563EB', color: '#fff', border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                    >
                      {inviteCopied ? 'Copied!' : 'Copy link'}
                    </button>
                    <button
                      onClick={regenerateInvite}
                      disabled={regenerating}
                      style={{ flex: 1, padding: '7px 0', border: '1px solid var(--border)', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: regenerating ? 'not-allowed' : 'pointer', background: 'transparent', color: 'var(--text-2)', opacity: regenerating ? 0.7 : 1 }}
                    >
                      {regenerating ? 'Regenerating…' : 'Regenerate link'}
                    </button>
                  </div>
                </div>
              )}

              {/* Permissions */}
              <div>
                <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
                  Permissions
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {PERM_KEYS.map(k => (
                    <div
                      key={k}
                      style={{
                        padding: '5px 12px', borderRadius: 8, fontSize: 12, fontWeight: 500,
                        background: member.permissions[k] ? 'rgba(37,99,235,0.1)' : 'var(--surface-2)',
                        color: member.permissions[k] ? '#2563EB' : 'var(--text-3)',
                        border: `1px solid ${member.permissions[k] ? 'rgba(37,99,235,0.2)' : 'var(--border)'}`,
                      }}
                    >
                      {PERM_LABELS[k]}
                    </div>
                  ))}
                </div>
              </div>

              {/* Non-negotiables */}
              <div>
                <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
                  Non-negotiables
                </p>
                {nonNegs.map(nn => (
                  <div key={nn.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                    <span style={{ flex: 1, fontSize: 13, color: 'var(--text-1)' }}>{nn.title}</span>
                    <button
                      onClick={() => removeNonNeg(nn.id)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', padding: 2 }}
                    >
                      <svg viewBox="0 0 20 20" fill="currentColor" width="13" height="13">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </div>
                ))}
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <input
                    value={newNonNeg} onChange={e => setNewNonNeg(e.target.value)}
                    placeholder="Add item…" onKeyDown={e => e.key === 'Enter' && addNonNeg()}
                    style={{ flex: 1, ...inputStyle, padding: '7px 10px', fontSize: 13 }}
                  />
                  <button onClick={addNonNeg} style={{ padding: '7px 14px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 7, fontSize: 13, cursor: 'pointer', color: 'var(--text-1)' }}>
                    Add
                  </button>
                </div>
              </div>

              {/* EOD gate time */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 10 }}>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)', margin: '0 0 2px' }}>EOD gate time</p>
                  <p style={{ fontSize: 12, color: 'var(--text-3)', margin: 0 }}>The EOD report prompt appears after this hour each day</p>
                </div>
                <select
                  value={eodHour}
                  onChange={e => setEodHour(Number(e.target.value))}
                  style={{ padding: '7px 10px', background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, color: 'var(--text-1)', cursor: 'pointer', flexShrink: 0 }}
                >
                  {Array.from({ length: 24 }, (_, h) => (
                    <option key={h} value={h}>
                      {String(h).padStart(2, '0')}:00
                    </option>
                  ))}
                </select>
              </div>

              {/* EOD questions */}
              <div>
                <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
                  EOD questions
                </p>
                {questions.map((q, i) => (
                  <div key={q.id} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontSize: 12, color: 'var(--text-3)', minWidth: 16 }}>{i + 1}.</span>
                    <input
                      value={q.label}
                      onChange={e => updateQuestion(q.id, 'label', e.target.value)}
                      placeholder="Question text"
                      style={{ flex: 1, ...inputStyle, padding: '7px 10px', fontSize: 13 }}
                    />
                    <select
                      value={q.type}
                      onChange={e => updateQuestion(q.id, 'type', e.target.value as CheckinQuestionType)}
                      style={{ padding: '7px 8px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 7, fontSize: 12, color: 'var(--text-1)', cursor: 'pointer' }}
                    >
                      {(Object.keys(Q_TYPE_LABELS) as CheckinQuestionType[]).map(t => (
                        <option key={t} value={t}>{Q_TYPE_LABELS[t]}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => removeQuestion(q.id)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', padding: 2 }}
                    >
                      <svg viewBox="0 0 20 20" fill="currentColor" width="13" height="13">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </div>
                ))}
                <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                  <button onClick={addQuestion} style={{ padding: '7px 14px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 7, fontSize: 13, cursor: 'pointer', color: 'var(--text-1)' }}>
                    + Add question
                  </button>
                  <button
                    onClick={saveTemplate}
                    disabled={savingTemplate}
                    style={{ padding: '7px 14px', background: '#2563EB', color: '#fff', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: savingTemplate ? 'not-allowed' : 'pointer', opacity: savingTemplate ? 0.7 : 1 }}
                  >
                    {savingTemplate ? 'Saving…' : 'Save questions'}
                  </button>
                </div>
              </div>

              {/* Weekly check-in */}
              <div>
                <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
                  Weekly check-in
                </p>

                {/* Enable toggle */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 10, marginBottom: 10 }}>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)', margin: '0 0 2px' }}>Enable weekly check-in</p>
                    <p style={{ fontSize: 12, color: 'var(--text-3)', margin: 0 }}>Show a weekly reflection prompt on the configured day</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setWeeklyEnabled(e => !e)}
                    style={{
                      width: 40, height: 22, borderRadius: 11, border: 'none', cursor: 'pointer', flexShrink: 0,
                      background: weeklyEnabled ? '#2563EB' : 'var(--border-strong)',
                      position: 'relative', transition: 'background 150ms',
                    }}
                  >
                    <span style={{
                      position: 'absolute', top: 3, left: weeklyEnabled ? 21 : 3,
                      width: 16, height: 16, borderRadius: '50%', background: '#fff',
                      transition: 'left 150ms',
                    }} />
                  </button>
                </div>

                {/* Day selector (only when enabled) */}
                {weeklyEnabled && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 10, marginBottom: 10 }}>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)', margin: '0 0 2px' }}>Check-in day</p>
                      <p style={{ fontSize: 12, color: 'var(--text-3)', margin: 0 }}>Day of week to show the weekly check-in prompt</p>
                    </div>
                    <select
                      value={weeklyDay}
                      onChange={e => setWeeklyDay(Number(e.target.value))}
                      style={{ padding: '7px 10px', background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, color: 'var(--text-1)', cursor: 'pointer', flexShrink: 0 }}
                    >
                      {DAY_LABELS.map((label, i) => (
                        <option key={i} value={i}>{label}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Weekly questions */}
                {weeklyQuestions.map((q, i) => (
                  <div key={q.id} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontSize: 12, color: 'var(--text-3)', minWidth: 16 }}>{i + 1}.</span>
                    <input
                      value={q.label}
                      onChange={e => updateWeeklyQuestion(q.id, 'label', e.target.value)}
                      placeholder="Question text"
                      style={{ flex: 1, ...inputStyle, padding: '7px 10px', fontSize: 13 }}
                    />
                    <select
                      value={q.type}
                      onChange={e => updateWeeklyQuestion(q.id, 'type', e.target.value as CheckinQuestionType)}
                      style={{ padding: '7px 8px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 7, fontSize: 12, color: 'var(--text-1)', cursor: 'pointer' }}
                    >
                      {(Object.keys(Q_TYPE_LABELS) as CheckinQuestionType[]).map(t => (
                        <option key={t} value={t}>{Q_TYPE_LABELS[t]}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => removeWeeklyQuestion(q.id)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', padding: 2 }}
                    >
                      <svg viewBox="0 0 20 20" fill="currentColor" width="13" height="13">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </div>
                ))}
                <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                  <button onClick={addWeeklyQuestion} style={{ padding: '7px 14px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 7, fontSize: 13, cursor: 'pointer', color: 'var(--text-1)' }}>
                    + Add question
                  </button>
                  <button
                    onClick={saveWeeklyTemplate}
                    disabled={savingWeekly}
                    style={{ padding: '7px 14px', background: '#2563EB', color: '#fff', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: savingWeekly ? 'not-allowed' : 'pointer', opacity: savingWeekly ? 0.7 : 1 }}
                  >
                    {savingWeekly ? 'Saving…' : 'Save weekly'}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Shared primitives ────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  padding: '9px 12px',
  background: 'var(--surface-2)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  fontSize: 14,
  color: 'var(--text-1)',
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-2)', display: 'block', marginBottom: 6 }}>{label}</label>
      {children}
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

type Tab = 'dashboard' | 'members' | 'tasks'

const TAB_LABELS: Record<Tab, string> = {
  dashboard: 'Dashboard',
  members: 'Members',
  tasks: 'Tasks',
}

export default function TeamClient({ initialMembers }: Props) {
  const [members, setMembers] = useState<TeamMember[]>(initialMembers)
  const [addOpen, setAddOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<Tab>('dashboard')

  return (
    <div style={{ padding: 24, maxWidth: 720, margin: '0 auto' }}>
      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-1)', margin: '0 0 4px' }}>Team</h1>
          <p style={{ fontSize: 14, color: 'var(--text-2)', margin: 0 }}>
            {members.length} member{members.length !== 1 ? 's' : ''}
          </p>
        </div>
        {activeTab === 'members' && (
          <button
            onClick={() => setAddOpen(true)}
            style={{ padding: '9px 18px', background: '#2563EB', color: '#fff', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
          >
            Add member
          </button>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, background: 'var(--surface-2)', borderRadius: 10, padding: 4, marginBottom: 20 }}>
        {(Object.keys(TAB_LABELS) as Tab[]).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              flex: 1, padding: '8px 0', borderRadius: 7, fontSize: 13, fontWeight: 600,
              border: 'none', cursor: 'pointer', transition: 'all 120ms',
              background: activeTab === tab ? 'var(--surface-1)' : 'transparent',
              color: activeTab === tab ? 'var(--text-1)' : 'var(--text-3)',
              boxShadow: activeTab === tab ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
            }}
          >
            {TAB_LABELS[tab]}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'dashboard' && (
        <TeamDashboard members={members} />
      )}

      {activeTab === 'members' && (
        members.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60, background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: 'var(--radius-card)' }}>
            <p style={{ fontSize: 36, marginBottom: 12 }}>👥</p>
            <p style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-1)', marginBottom: 6 }}>No team members yet</p>
            <p style={{ fontSize: 14, color: 'var(--text-2)', marginBottom: 20 }}>Add your first setter or closer to collaborate.</p>
            <button onClick={() => setAddOpen(true)} style={{ padding: '10px 24px', background: '#2563EB', color: '#fff', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
              Add team member
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {members.map(m => <MemberCard key={m.id} member={m} />)}
          </div>
        )
      )}

      {activeTab === 'tasks' && (
        <div style={{ textAlign: 'center', padding: 48, background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: 'var(--radius-card)' }}>
          <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-1)', marginBottom: 8 }}>Team Tasks live on their own page</p>
          <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 20 }}>Create and manage tasks for your team members.</p>
          <Link
            href="/team/tasks"
            style={{
              display: 'inline-block', padding: '10px 24px',
              background: '#2563EB', color: '#fff', border: 'none', borderRadius: 10,
              fontSize: 14, fontWeight: 600, cursor: 'pointer', textDecoration: 'none',
            }}
          >
            Go to Team Tasks →
          </Link>
        </div>
      )}

      {addOpen && (
        <AddMemberModal
          onClose={() => setAddOpen(false)}
          onAdded={m => { setMembers(prev => [...prev, m]); setAddOpen(false) }}
        />
      )}
    </div>
  )
}
