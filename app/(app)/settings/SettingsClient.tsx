'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { getLiveRate } from '@/lib/exchange-rates-client'
import type { KpiTargets, Setter, User, SecondaryCurrency, SetterRole } from '@/types'
import { CURRENCIES, TIMEZONES, resolveNotifPrefs } from '@/types'
import IntegrationGuide, { type GuideStep } from './IntegrationGuide'
import { useT } from '@/contexts/LanguageContext'
import { useWalkthrough } from '@/components/walkthrough/WalkthroughContext'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  userId: string
  userEmail: string
  isAdmin?: boolean
  profile: User
  targets: KpiTargets | null
  setters: Setter[]
  secondaryCurrencies: SecondaryCurrency[]
  initialSection?: Section
  calendlyResult?: 'error' | 'ok'
  calendlyErrorStep?: string
  calendlyErrorDetail?: string
}

type Section = 'targets' | 'setters' | 'integrations' | 'notifications' | 'account' | 'checkins'

// ─── Shared primitives ────────────────────────────────────────────────────────

const CARD: React.CSSProperties = {
  background: 'var(--surface-1)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-card)',
  padding: 20,
}

function StatusDot({ on }: { on: boolean }) {
  return (
    <span style={{
      display: 'inline-block',
      width: 8,
      height: 8,
      borderRadius: '50%',
      background: on ? 'var(--success)' : 'var(--border-strong)',
      flexShrink: 0,
    }} />
  )
}

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        position: 'relative',
        width: 44,
        height: 24,
        borderRadius: 12,
        background: on ? 'var(--accent)' : 'var(--surface-3)',
        border: 'none',
        cursor: 'pointer',
        transition: 'background 150ms ease',
        flexShrink: 0,
        padding: 0,
      }}
    >
      <span style={{
        position: 'absolute',
        top: 4,
        width: 16,
        height: 16,
        borderRadius: '50%',
        background: '#fff',
        boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
        transition: 'transform 150ms ease',
        transform: on ? 'translateX(24px)' : 'translateX(4px)',
      }} />
    </button>
  )
}

// ─── Section: KPI Targets ─────────────────────────────────────────────────────

function TargetsSection({ userId, targets, baseCurrency }: { userId: string; targets: KpiTargets | null; baseCurrency: string }) {
  const [values, setValues] = useState({
    cash_target: String(targets?.cash_target ?? ''),
    revenue_target: String(targets?.revenue_target ?? ''),
    clients_target: String(targets?.clients_target ?? ''),
    meetings_target: String(targets?.meetings_target ?? ''),
    followers_target: String(targets?.followers_target ?? ''),
    reply_rate_target: String(targets?.reply_rate_target ?? ''),
    booking_rate_target: String(targets?.booking_rate_target ?? ''),
    close_rate_target: String(targets?.close_rate_target ?? ''),
    show_up_target: String(targets?.show_up_target ?? ''),
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  async function handleSave() {
    setSaving(true)
    setSaveError(null)
    const supabase = createClient()
    const { error } = await supabase.from('kpi_targets').upsert(
      {
        user_id: userId,
        ...Object.fromEntries(
          Object.entries(values).map(([k, v]) => [k, v !== '' ? Number(v) : null])
        ),
      },
      { onConflict: 'user_id' }
    )
    setSaving(false)
    if (error) {
      setSaveError(error.message)
    } else {
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    }
  }

  const groups = [
    {
      title: 'Revenue',
      fields: [
        { key: 'cash_target', label: 'Monthly cash target', unit: baseCurrency },
        { key: 'revenue_target', label: 'Monthly revenue contracted', unit: baseCurrency },
      ],
    },
    {
      title: 'Pipeline',
      fields: [
        { key: 'clients_target', label: 'New clients per month', unit: 'clients' },
        { key: 'meetings_target', label: 'Meetings booked per month', unit: 'meetings' },
        { key: 'followers_target', label: 'New followers per month', unit: 'followers' },
      ],
    },
    {
      title: 'Conversion targets',
      fields: [
        { key: 'reply_rate_target',   label: 'Reply rate target',    unit: '%' },
        { key: 'booking_rate_target', label: 'Booking rate target',  unit: '%' },
        { key: 'close_rate_target',   label: 'Close rate target',    unit: '%' },
        { key: 'show_up_target',      label: 'Show-up rate target',  unit: '%' },
      ],
    },
  ] as { title: string; fields: { key: keyof typeof values; label: string; unit: string }[] }[]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {groups.map(g => (
        <div key={g.title} style={CARD}>
          <p className="section-title" style={{ marginBottom: 16 }}>{g.title}</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {g.fields.map(f => (
              <div key={f.key} style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                <label style={{ flex: 1, minWidth: 120, fontSize: 13, color: 'var(--text-1)' }}>{f.label}</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input
                    type="number"
                    value={values[f.key]}
                    onChange={e => setValues(v => ({ ...v, [f.key]: e.target.value }))}
                    placeholder="—"
                    className="input-base"
                    style={{ width: 96, textAlign: 'right' }}
                  />
                  <span className="label-caps" style={{ width: 56, textAlign: 'left' }}>{f.unit}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {saveError && (
        <p style={{ fontSize: 12, color: 'var(--danger)', background: 'rgba(220,38,38,0.06)', borderRadius: 'var(--radius-btn)', padding: '8px 12px' }}>
          {saveError}
        </p>
      )}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button
          onClick={handleSave}
          disabled={saving}
          className="btn-primary"
          style={saved ? { background: 'var(--success)' } : undefined}
        >
          {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save targets'}
        </button>
      </div>
    </div>
  )
}

// ─── Section: Setters ─────────────────────────────────────────────────────────

function SettersSection({ userId, initialSetters }: { userId: string; initialSetters: Setter[] }) {
  const [setters, setSetters] = useState<Setter[]>(initialSetters)
  const [newName, setNewName] = useState('')
  const [newRole, setNewRole] = useState<SetterRole>('setter')
  const [adding, setAdding] = useState(false)
  const supabase = createClient()

  async function addSetter() {
    if (!newName.trim()) return
    setAdding(true)
    const { data } = await supabase.from('setters').insert({
      user_id: userId,
      name: newName.trim(),
      role: newRole,
      is_self: false,
    }).select().single()
    if (data) setSetters(ss => [...ss, data as Setter])
    setNewName('')
    setAdding(false)
  }

  const [confirmRemove, setConfirmRemove] = useState<string | null>(null)

  async function removeSetters(id: string) {
    await supabase.from('setters').update({ active: false }).eq('id', id)
    setSetters(ss => ss.filter(s => s.id !== id))
    setConfirmRemove(null)
  }

  async function updateRole(id: string, role: SetterRole) {
    await supabase.from('setters').update({ role }).eq('id', id)
    setSetters(ss => ss.map(s => s.id === id ? { ...s, role } : s))
  }

  return (
    <div style={CARD}>
      <p className="section-title" style={{ marginBottom: 16 }}>Your team</p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
        {setters.map(s => (
          <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* Avatar */}
            <div style={{
              width: 32, height: 32, borderRadius: '50%',
              background: 'rgba(37,99,235,0.1)', color: 'var(--accent)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, fontWeight: 700, flexShrink: 0,
            }}>
              {s.name.charAt(0).toUpperCase()}
            </div>
            <div style={{ flex: 1 }}>
              <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-1)' }}>
                {s.name}
                {s.is_self && (
                  <span style={{ marginLeft: 6, fontSize: 11, color: 'var(--text-3)' }}>(you)</span>
                )}
              </span>
            </div>
            <select
              value={s.role}
              onChange={e => updateRole(s.id, e.target.value as SetterRole)}
              className="input-base"
              style={{ width: 'auto', fontSize: 12 }}
            >
              <option value="setter">Setter</option>
              <option value="closer">Closer</option>
              <option value="both">Both</option>
            </select>
            {!s.is_self && (
              confirmRemove === s.id ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 12, color: 'var(--text-2)' }}>Remove?</span>
                  <button
                    onClick={() => removeSetters(s.id)}
                    style={{ fontSize: 12, fontWeight: 600, color: 'var(--danger)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                  >
                    Yes
                  </button>
                  <button
                    onClick={() => setConfirmRemove(null)}
                    style={{ fontSize: 12, color: 'var(--text-3)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmRemove(s.id)}
                  style={{ color: 'var(--border-strong)', background: 'none', border: 'none', cursor: 'pointer', padding: 2, lineHeight: 0, transition: 'color 120ms ease' }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'var(--danger)')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'var(--border-strong)')}
                >
                  <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
                    <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </button>
              )
            )}
          </div>
        ))}
      </div>

      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
        <p className="label-caps" style={{ marginBottom: 10 }}>Add person</p>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="Name"
            className="input-base"
            onKeyDown={e => e.key === 'Enter' && addSetter()}
            style={{ flex: 1 }}
          />
          <select
            value={newRole}
            onChange={e => setNewRole(e.target.value as SetterRole)}
            className="input-base"
            style={{ width: 'auto' }}
          >
            <option value="setter">Setter</option>
            <option value="closer">Closer</option>
            <option value="both">Both</option>
          </select>
          <button
            onClick={addSetter}
            disabled={adding || !newName.trim()}
            className="btn-primary"
          >
            Add
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Section: Integrations ────────────────────────────────────────────────────

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)
  function copy() {
    navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button
      onClick={copy}
      className="btn-ghost"
      style={{ padding: '4px 10px', fontSize: 11, flexShrink: 0 }}
    >
      {copied ? '✓ Copied' : 'Copy'}
    </button>
  )
}

function IntegrationIcon({ type }: { type: 'webhook' | 'stripe' | 'calendly' | 'sheets' }) {
  const configs = {
    webhook: { bg: 'rgba(245,158,11,0.12)', icon: (
      <svg viewBox="0 0 20 20" fill="none" width="16" height="16" stroke="#D97706" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round">
        <path d="M11 2L4 11h7l-2 7 9-10h-7l2-8z" />
      </svg>
    )},
    stripe: { bg: 'rgba(99,91,255,0.12)', icon: (
      <span style={{ fontSize: 14, fontWeight: 700, color: '#635BFF', lineHeight: 1 }}>S</span>
    )},
    calendly: { bg: 'rgba(0,108,206,0.1)', icon: (
      <svg viewBox="0 0 20 20" fill="none" width="16" height="16" stroke="#006CCE" strokeWidth="1.5" strokeLinecap="round">
        <rect x="3" y="4" width="14" height="13" rx="2" />
        <path d="M7 2v4M13 2v4M3 9h14" />
      </svg>
    )},
    sheets: { bg: 'rgba(52,168,83,0.1)', icon: (
      <svg viewBox="0 0 20 20" fill="none" width="16" height="16" stroke="#34A853" strokeWidth="1.5">
        <rect x="3" y="3" width="14" height="14" rx="1.5" />
        <path d="M7 3v14M13 3v14M3 7h14M3 13h14" strokeLinecap="round" />
      </svg>
    )},
  }
  const { bg, icon } = configs[type]
  return (
    <div style={{
      width: 36, height: 36, borderRadius: 'var(--radius-btn)',
      background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0,
    }}>
      {icon}
    </div>
  )
}

function WebhookCard({
  name, desc, configured, webhookUrl, webhookSecret, instructions, jsonBody, docsUrl,
}: {
  emoji?: string
  name: string
  desc: string
  configured: boolean
  webhookUrl: string
  webhookSecret?: string | null
  instructions: string[]
  jsonBody?: string
  docsUrl?: string
}) {
  const [open, setOpen] = useState(false)

  return (
    <div style={{
      ...CARD,
      borderLeft: configured ? '3px solid var(--success)' : '3px solid var(--border)',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
        <IntegrationIcon type="webhook" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-1)' }}>{name}</span>
            <span style={{
              fontSize: 10, fontWeight: 600, padding: '2px 6px',
              borderRadius: 'var(--radius-badge)', background: 'var(--surface-2)',
              color: 'var(--text-3)', flexShrink: 0,
            }}>Optional</span>
            <StatusDot on={configured} />
            <span style={{ fontSize: 12, color: configured ? 'var(--success)' : 'var(--text-3)' }}>
              {configured ? 'Configured' : 'Not set up'}
            </span>
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.5 }}>{desc}</p>

          {/* Webhook URL */}
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-3)', marginBottom: 4 }}>Webhook URL</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <code style={{
                flex: 1, fontSize: 12,
                background: 'var(--surface-2)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-btn)', padding: '6px 10px',
                color: 'var(--text-2)', fontFamily: 'var(--font-mono)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                display: 'block',
              }}>
                {webhookUrl}
              </code>
              <CopyButton value={webhookUrl} />
            </div>
          </div>

          {/* Webhook secret */}
          {webhookSecret && (
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-3)', marginBottom: 4 }}>
                Secret header value <span style={{ fontWeight: 400 }}>(x-zapier-secret)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <code style={{
                  flex: 1, fontSize: 12,
                  background: 'var(--surface-2)', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-btn)', padding: '6px 10px',
                  color: 'var(--text-2)', fontFamily: 'var(--font-mono)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  display: 'block',
                }}>
                  {webhookSecret}
                </code>
                <CopyButton value={webhookSecret} />
              </div>
            </div>
          )}

          {/* Setup instructions toggle */}
          <button
            onClick={() => setOpen(o => !o)}
            style={{ marginTop: 8, fontSize: 12, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            {open ? 'Hide setup steps ↑' : 'How to set up ↓'}
          </button>

          {open && (
            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <ol style={{ paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4, listStyle: 'decimal', margin: 0 }}>
                {instructions.map((step, i) => (
                  <li key={i} style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.5 }}>{step}</li>
                ))}
                {docsUrl && (
                  <li style={{ fontSize: 12 }}>
                    <a href={docsUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }}>
                      Open platform →
                    </a>
                  </li>
                )}
              </ol>

              {/* Copyable JSON body */}
              {jsonBody && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-3)', marginBottom: 4 }}>Request body — copy and paste this:</div>
                  <div style={{ position: 'relative' }}>
                    <pre style={{
                      fontSize: 11, lineHeight: 1.6,
                      background: 'var(--surface-2)', border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-btn)', padding: '8px 10px',
                      color: 'var(--text-2)', fontFamily: 'var(--font-mono)',
                      overflowX: 'auto', margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                    }}>
                      {jsonBody}
                    </pre>
                    <div style={{ position: 'absolute', top: 6, right: 6 }}>
                      <CopyButton value={jsonBody} />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

interface IntegrationStatus {
  zapier: { configured: boolean; webhook_url: string; webhook_secret: string | null }
  stripe: { configured: boolean; webhook_url: string }
}

interface GoogleStatus {
  connected: boolean
  spreadsheet_url?: string
  last_synced_at?: string
}

function GoogleSheetsCard() {
  const [status, setStatus] = useState<GoogleStatus>({ connected: false })
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [syncError, setSyncError] = useState<string | null>(null)
  const [disconnecting, setDisconnecting] = useState(false)

  useEffect(() => {
    fetch('/api/google/status')
      .then(r => r.json())
      .then(d => setStatus(d))
      .finally(() => setLoading(false))
    try {
      const raw = localStorage.getItem('drivn_sheets_last_sync')
      if (raw) {
        const parsed = JSON.parse(raw)
        if (!parsed.ok) setSyncError(parsed.error ?? 'Unknown error')
      }
    } catch { /* ignore */ }
  }, [])

  async function handleSync() {
    setSyncing(true)
    setSyncError(null)
    const res = await fetch('/api/google/sync', { method: 'POST' })
    if (res.ok) {
      const data = await res.json()
      setStatus(s => ({
        ...s,
        connected: true,
        spreadsheet_url: data.spreadsheetUrl ?? s.spreadsheet_url,
        last_synced_at: new Date().toISOString(),
      }))
      localStorage.setItem('drivn_sheets_last_sync', JSON.stringify({ ok: true, at: new Date().toISOString() }))
    } else {
      const body = await res.json().catch(() => ({}))
      const msg = body?.error ?? `Sync failed (HTTP ${res.status})`
      setSyncError(msg)
      localStorage.setItem('drivn_sheets_last_sync', JSON.stringify({ ok: false, at: new Date().toISOString(), error: msg }))
    }
    setSyncing(false)
  }

  async function handleDisconnect() {
    setDisconnecting(true)
    await fetch('/api/google/disconnect', { method: 'POST' })
    setStatus({ connected: false })
    setDisconnecting(false)
  }

  function formatSynced(iso: string) {
    const diffMs = Date.now() - new Date(iso).getTime()
    const mins = Math.floor(diffMs / 60000)
    const hours = Math.floor(mins / 60)
    const days = Math.floor(hours / 24)
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'} ago`
    if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`
    return `${days} day${days === 1 ? '' : 's'} ago`
  }

  return (
    <div style={{
      ...CARD,
      borderLeft: status.connected ? '3px solid var(--success)' : '3px solid var(--border)',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
        <IntegrationIcon type="sheets" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-1)' }}>Google Sheets</span>
            <span style={{
              fontSize: 10, fontWeight: 600, padding: '2px 6px',
              borderRadius: 'var(--radius-badge)', background: 'var(--surface-2)',
              color: 'var(--text-3)', flexShrink: 0,
            }}>Optional</span>
            {!loading && <StatusDot on={status.connected} />}
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.5 }}>
            Syncs your pipeline, revenue, and KPIs to a Google Sheet automatically. Skip this and track manually instead.
          </p>

          {!status.connected && !loading && (
            <ol style={{ marginTop: 8, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 3, listStyle: 'decimal' }}>
              <li style={{ fontSize: 12, color: 'var(--text-2)' }}>
                Click <strong style={{ color: 'var(--text-1)' }}>Connect Google</strong> → sign in with the Google account where you want the sheet
              </li>
              <li style={{ fontSize: 12, color: 'var(--text-2)' }}>
                Click <strong style={{ color: 'var(--text-1)' }}>Allow</strong> when Google asks for spreadsheet access
              </li>
              <li style={{ fontSize: 12, color: 'var(--text-2)' }}>
                Done — Drivn creates a spreadsheet in your Drive and starts syncing automatically
              </li>
            </ol>
          )}

          {status.connected && (
            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 3 }}>
              {status.spreadsheet_url && (
                <a
                  href={status.spreadsheet_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ fontSize: 12, color: 'var(--accent)', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}
                >
                  Open spreadsheet →
                </a>
              )}
              {status.last_synced_at && !syncError && (
                <p style={{ fontSize: 12, color: 'var(--text-3)' }}>Last synced {formatSynced(status.last_synced_at)}</p>
              )}
              {syncError && (
                <p style={{ fontSize: 12, color: 'var(--danger)' }}>Sync failed: {syncError}</p>
              )}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
          {loading ? (
            <span style={{ fontSize: 12, color: 'var(--text-3)', padding: '6px 0' }}>Loading…</span>
          ) : status.connected ? (
            <>
              <button onClick={handleSync} disabled={syncing} className="btn-primary" style={{ fontSize: 12, padding: '5px 12px' }}>
                {syncing ? 'Syncing…' : 'Sync now'}
              </button>
              <button onClick={handleDisconnect} disabled={disconnecting} className="btn-ghost" style={{ fontSize: 12, padding: '4px 10px' }}>
                {disconnecting ? 'Removing…' : 'Disconnect'}
              </button>
            </>
          ) : (
            <a
              href="/api/google/auth"
              className="btn-ghost"
              style={{ fontSize: 13, padding: '6px 14px', textAlign: 'center', whiteSpace: 'nowrap', textDecoration: 'none', display: 'inline-block' }}
            >
              Connect Google
            </a>
          )}
        </div>
      </div>
    </div>
  )
}

const stripeSteps: GuideStep[] = [
  {
    title: 'Go to Developers',
    description: 'Log into dashboard.stripe.com and click "Developers" in the left sidebar.',
    visual: (
      <div className="flex h-full w-full">
        <div className="w-36 bg-white border-r border-gray-200 flex flex-col py-3 px-2 gap-0.5">
          <div className="flex items-center gap-1.5 px-2 py-1.5 mb-2">
            <div className="w-5 h-5 rounded bg-indigo-600 flex items-center justify-center">
              <span className="text-white font-bold" style={{ fontSize: 9 }}>S</span>
            </div>
            <span className="text-xs font-bold text-gray-800">Stripe</span>
          </div>
          {['Home', 'Payments', 'Customers'].map(item => (
            <div key={item} className="px-2 py-1 rounded text-xs text-gray-500">{item}</div>
          ))}
          <div className="px-2 py-1 rounded text-xs font-semibold text-indigo-700 bg-indigo-50 flex items-center gap-1.5">
            Developers
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse flex-shrink-0" />
          </div>
        </div>
        <div className="flex-1 bg-gray-50 flex items-center justify-center">
          <span className="text-xs text-gray-300">Select Developers →</span>
        </div>
      </div>
    ),
  },
  {
    title: 'Click Webhooks → Add destination',
    description: 'Inside Developers, click "Webhooks" in the sub-menu, then hit "Add destination" in the top right.',
    visual: (
      <div className="flex flex-col w-full h-full bg-white p-3">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-bold text-gray-800">Webhooks</span>
          <div className="relative px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-medium ring-2 ring-indigo-300 ring-offset-1 animate-pulse">
            + Add destination
          </div>
        </div>
        <div className="border border-gray-100 rounded-lg divide-y divide-gray-50">
          {['https://example.com/webhook', 'https://old-hook.io/stripe'].map(u => (
            <div key={u} className="px-3 py-2 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-400 flex-shrink-0" />
              <span className="text-xs text-gray-500 truncate">{u}</span>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    title: 'Paste your destination URL',
    description: 'Paste the webhook URL from above into the "Destination URL" field, then continue.',
    visual: (
      <div className="flex flex-col w-full h-full bg-white justify-center p-4 gap-3">
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Endpoint URL</label>
          <div className="flex items-center gap-1.5 px-3 py-2 border-2 border-indigo-400 rounded-lg bg-indigo-50">
            <span className="text-xs text-gray-700 truncate flex-1 font-mono">
              https://yourdomain.com/api/webhooks/stripe
            </span>
            <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5 text-gray-400 flex-shrink-0">
              <rect x="1" y="4" width="9" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
              <path d="M5 4V3a1 1 0 011-1h7a1 1 0 011 1v9a1 1 0 01-1 1h-1" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          </div>
        </div>
        <p className="text-xs text-indigo-600">Paste the URL copied from Drivn above</p>
      </div>
    ),
  },
  {
    title: 'Select payment events',
    description: 'Under "Select events", search and check both payment events shown below.',
    visual: (
      <div className="flex flex-col w-full h-full bg-white justify-center p-4 gap-2">
        <label className="text-xs font-semibold text-gray-600 mb-1">Select events to listen to</label>
        <div className="flex items-center gap-2 px-2 py-1.5 border border-gray-200 rounded-lg mb-1">
          <svg viewBox="0 0 16 16" className="w-3 h-3 text-gray-400 flex-shrink-0">
            <circle cx="6.5" cy="6.5" r="5" stroke="currentColor" strokeWidth="1.5" />
            <path d="M10 10l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <span className="text-xs text-gray-400">Search events…</span>
        </div>
        {[
          'payment_intent.succeeded',
          'payment_intent.payment_failed',
        ].map(ev => (
          <div key={ev} className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-green-50 border border-green-200">
            <svg viewBox="0 0 16 16" className="w-3.5 h-3.5 text-green-600 flex-shrink-0">
              <rect x="1" y="1" width="14" height="14" rx="3" fill="currentColor" opacity="0.15" />
              <path d="M4 8l3 3 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="text-xs font-mono text-green-800">{ev}</span>
          </div>
        ))}
      </div>
    ),
  },
  {
    title: 'Copy the signing secret',
    description: 'After saving the destination, click "Reveal" next to Signing secret and copy the whsec_… value.',
    visual: (
      <div className="flex flex-col w-full h-full bg-white justify-center p-4 gap-2">
        <label className="text-xs font-semibold text-gray-600 mb-1">Signing secret</label>
        <div className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg bg-gray-50">
          <span className="flex-1 text-xs font-mono text-gray-400 tracking-widest select-none blur-[3px]">
            whsec_••••••••••••••••••
          </span>
          <div className="px-2 py-1 rounded bg-indigo-600 text-white text-xs font-medium ring-2 ring-indigo-300 animate-pulse flex-shrink-0">
            Reveal
          </div>
        </div>
        <p className="text-xs text-gray-400">Copy the revealed secret → paste it into Drivn below</p>
      </div>
    ),
  },
]

function StripeCard({ webhookUrl }: { webhookUrl: string }) {
  const [connected, setConnected] = useState(false)
  const [loading, setLoading] = useState(true)
  const [secret, setSecret] = useState('')
  const [saving, setSaving] = useState(false)
  const [showInput, setShowInput] = useState(false)
  const [copied, setCopied] = useState(false)
  const [showGuide, setShowGuide] = useState(false)

  useEffect(() => {
    fetch('/api/settings/stripe')
      .then(r => r.json())
      .then(d => { setConnected(d.connected); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  async function handleSave() {
    if (!secret.trim()) return
    setSaving(true)
    await fetch('/api/settings/stripe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret: secret.trim() }),
    })
    setConnected(true)
    setShowInput(false)
    setSecret('')
    setSaving(false)
  }

  async function handleDisconnect() {
    await fetch('/api/settings/stripe', { method: 'DELETE' })
    setConnected(false)
  }

  function copyUrl() {
    navigator.clipboard.writeText(webhookUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <>
      <div style={{
        ...CARD,
        borderLeft: connected ? '3px solid var(--success)' : '3px solid var(--border)',
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
          <IntegrationIcon type="stripe" />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-1)' }}>Stripe</span>
              <span style={{
                fontSize: 10, fontWeight: 600, padding: '2px 6px',
                borderRadius: 'var(--radius-badge)', background: 'var(--surface-2)',
                color: 'var(--text-3)', flexShrink: 0,
              }}>Optional</span>
              {!loading && <StatusDot on={connected} />}
              {!loading && (
                <span style={{ fontSize: 12, color: connected ? 'var(--success)' : 'var(--text-3)' }}>
                  {connected ? 'Connected' : 'Not connected'}
                </span>
              )}
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.5 }}>
              Automatically marks clients as paid when a Stripe payment goes through.
            </p>

            {/* Webhook URL */}
            <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
              <code style={{
                flex: 1, fontSize: 12,
                background: 'var(--surface-2)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-btn)', padding: '6px 10px',
                color: 'var(--text-2)', fontFamily: 'var(--font-mono)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                display: 'block',
              }}>
                {webhookUrl}
              </code>
              <button onClick={copyUrl} className="btn-ghost" style={{ padding: '4px 10px', fontSize: 11, flexShrink: 0 }}>
                {copied ? '✓ Copied' : 'Copy'}
              </button>
            </div>

            {/* Secret input */}
            {showInput && (
              <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
                <input
                  type="password"
                  value={secret}
                  onChange={e => setSecret(e.target.value)}
                  placeholder="whsec_…"
                  className="input-base"
                  style={{ flex: 1, fontFamily: 'var(--font-mono)', fontSize: 12 }}
                />
                <button onClick={handleSave} disabled={saving} className="btn-primary" style={{ fontSize: 12, padding: '5px 12px' }}>
                  {saving ? 'Saving…' : 'Save'}
                </button>
                <button onClick={() => setShowInput(false)} className="btn-ghost" style={{ fontSize: 12, padding: '4px 10px' }}>
                  Cancel
                </button>
              </div>
            )}

            {/* Guide toggle */}
            <button
              onClick={() => setShowGuide(g => !g)}
              style={{ marginTop: 8, fontSize: 12, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
            >
              {showGuide ? 'Hide setup guide ↑' : 'How to set up ↓'}
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
            {loading ? (
              <span style={{ fontSize: 12, color: 'var(--text-3)', padding: '6px 0' }}>Loading…</span>
            ) : connected ? (
              <>
                <button onClick={() => setShowInput(s => !s)} className="btn-ghost" style={{ fontSize: 12, padding: '4px 10px' }}>
                  Update secret
                </button>
                <button onClick={handleDisconnect} className="btn-ghost" style={{ fontSize: 12, padding: '4px 10px' }}>
                  Disconnect
                </button>
              </>
            ) : (
              <button onClick={() => setShowInput(s => !s)} className="btn-primary" style={{ fontSize: 12, padding: '5px 12px' }}>
                Connect Stripe
              </button>
            )}
          </div>
        </div>
      </div>

      {showGuide && (
        <IntegrationGuide steps={stripeSteps} onClose={() => setShowGuide(false)} />
      )}
    </>
  )
}

function CalendlyCard({
  oauthResult,
  errorStep,
  errorDetail,
}: {
  oauthResult?: 'error' | 'ok'
  errorStep?: string
  errorDetail?: string
}) {
  const [connected, setConnected] = useState(false)
  const [loading, setLoading] = useState(true)
  const [showError, setShowError] = useState(oauthResult === 'error')
  const [disconnecting, setDisconnecting] = useState(false)

  useEffect(() => {
    fetch('/api/calendly/status')
      .then(r => r.json())
      .then(d => { setConnected(d.connected); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  async function handleDisconnect() {
    setDisconnecting(true)
    await fetch('/api/calendly/status', { method: 'DELETE' })
    setConnected(false)
    setDisconnecting(false)
  }

  return (
    <div style={{
      ...CARD,
      borderLeft: connected ? '3px solid var(--success)' : '3px solid var(--border)',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
        <IntegrationIcon type="calendly" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-1)' }}>Calendly</span>
            <span style={{
              fontSize: 10, fontWeight: 600, padding: '2px 6px',
              borderRadius: 'var(--radius-badge)', background: 'var(--surface-2)',
              color: 'var(--text-3)', flexShrink: 0,
            }}>Optional</span>
            {!loading && <StatusDot on={connected} />}
            {!loading && (
              <span style={{ fontSize: 12, color: connected ? 'var(--success)' : 'var(--text-3)' }}>
                {connected ? 'Connected' : 'Not connected'}
              </span>
            )}
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.5 }}>
            Automatically moves leads to &ldquo;Meeting booked&rdquo; when they schedule a call with you.
          </p>
          <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4, lineHeight: 1.5 }}>
            ⚠️ Requires Calendly Professional or higher to use webhooks.
          </p>

          {oauthResult === 'ok' && (
            <p style={{ marginTop: 8, fontSize: 12, color: 'var(--success)', fontWeight: 500 }}>
              Calendly connected successfully.
            </p>
          )}

          {showError && (
            <div style={{
              marginTop: 8, padding: '10px 12px',
              background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.15)',
              borderRadius: 'var(--radius-btn)', display: 'flex', flexDirection: 'column', gap: 4,
            }}>
              <p style={{ fontSize: 12, color: 'var(--danger)', fontWeight: 500 }}>
                OAuth failed{errorStep ? ` at step: ${errorStep}` : ''}
              </p>
              {errorDetail && (
                <p style={{ fontSize: 11, color: 'var(--text-2)', fontFamily: 'var(--font-mono)' }}>{errorDetail}</p>
              )}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
          {loading ? (
            <span style={{ fontSize: 12, color: 'var(--text-3)', padding: '6px 0' }}>Loading…</span>
          ) : connected ? (
            <>
              <button onClick={handleDisconnect} disabled={disconnecting} className="btn-ghost" style={{ fontSize: 12, padding: '4px 10px' }}>
                {disconnecting ? 'Disconnecting…' : 'Disconnect'}
              </button>
              {showError && (
                <a
                  href="/api/calendly/oauth/start"
                  className="btn-primary"
                  style={{ fontSize: 12, padding: '5px 12px', textAlign: 'center', textDecoration: 'none', display: 'inline-block' }}
                >
                  Reconnect
                </a>
              )}
            </>
          ) : (
            <a
              href="/api/calendly/oauth/start"
              className="btn-ghost"
              style={{ fontSize: 13, padding: '6px 14px', textAlign: 'center', whiteSpace: 'nowrap', textDecoration: 'none', display: 'inline-block' }}
            >
              Connect Calendly
            </a>
          )}
        </div>
      </div>
    </div>
  )
}

function IntegrationsSection({ calendlyResult, calendlyErrorStep, calendlyErrorDetail }: { calendlyResult?: 'error' | 'ok'; calendlyErrorStep?: string; calendlyErrorDetail?: string }) {
  const [status, setStatus] = useState<IntegrationStatus | null>(null)

  useEffect(() => {
    fetch('/api/integrations/status')
      .then(r => r.json())
      .then(d => setStatus(d))
      .catch(() => {})
  }, [])

  const zapierUrl = status?.zapier.webhook_url ?? `${window.location.origin}/api/webhooks/zapier`
  const stripeUrl = status?.stripe.webhook_url ?? `${window.location.origin}/api/webhooks/stripe`

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Info banner */}
      <div style={{
        padding: '10px 14px',
        background: 'rgba(217,119,6,0.07)',
        border: '1px solid rgba(217,119,6,0.2)',
        borderRadius: 'var(--radius-card)',
        fontSize: 12,
        color: 'var(--warning)',
        lineHeight: 1.5,
      }}>
        All integrations are <strong>optional</strong>. You can skip them and add leads, mark payments, and move pipeline stages manually at any time.
      </div>

      <WebhookCard
        name="ManyChat"
        desc="Automatically adds new followers to your pipeline when they DM you. Uses ManyChat's built-in External Request action — no Zapier needed."
        configured={status?.zapier.configured ?? false}
        webhookUrl={zapierUrl}
        webhookSecret={status?.zapier.webhook_secret}
        instructions={[
          'In ManyChat, open the flow you want to trigger (e.g. your DM welcome flow).',
          'Click the + button to add a step → choose Action → External Request.',
          'Set Method to POST and paste the Webhook URL above into the URL field.',
          'Set Content Type to application/json.',
          'Under Headers, add a new header: Key = x-zapier-secret, Value = paste the Secret header value from above.',
          'In the Request Body field, paste the JSON below — then replace {{instagram username}} with the ManyChat variable for your subscriber\'s Instagram handle.',
          'Click Test Request to verify, then Save and publish the flow.',
        ]}
        jsonBody={`{
  "type": "new_lead",
  "data": {
    "ig_username": "{{instagram username}}",
    "full_name": "{{full name}}",
    "source_flow": "manychat"
  }
}`}
        docsUrl="https://manychat.com"
      />

      <WebhookCard
        name="Zapier"
        desc="Connect any app to your pipeline via Zapier — Instagram Lead Ads, Typeform, Google Forms, and more."
        configured={status?.zapier.configured ?? false}
        webhookUrl={zapierUrl}
        webhookSecret={status?.zapier.webhook_secret}
        instructions={[
          'In Zapier, create a new Zap and set your Trigger to the lead source (e.g. Instagram Lead Ads, Typeform, etc.).',
          'For the Action, search for and choose Webhooks by Zapier → POST.',
          'Paste the Webhook URL above into the URL field.',
          'Set Body type to Raw and Content type to application/json.',
          'Under Headers, add: Key = x-zapier-secret, Value = paste the Secret header value from above.',
          'In the Body field, paste the JSON below — then replace the placeholder values with the data fields from your trigger step.',
          'Click Test and continue to verify a lead appears in your pipeline, then turn the Zap on.',
        ]}
        jsonBody={`{
  "type": "new_lead",
  "data": {
    "ig_username": "INSTAGRAM_HANDLE_FIELD",
    "full_name": "FULL_NAME_FIELD",
    "source_flow": "zapier"
  }
}`}
        docsUrl="https://zapier.com"
      />

      <StripeCard webhookUrl={stripeUrl} />

      <CalendlyCard oauthResult={calendlyResult} errorStep={calendlyErrorStep} errorDetail={calendlyErrorDetail} />

      <GoogleSheetsCard />
    </div>
  )
}

// ─── Section: Notifications ───────────────────────────────────────────────────

function NotificationsSection({ userId }: { userId: string }) {
  const supabase = createClient()
  const [prefs, setPrefs] = useState<import('@/types').NotificationPrefs | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    supabase.from('users').select('notification_prefs').eq('id', userId).single()
      .then(({ data }) => {
        setPrefs(resolveNotifPrefs(data?.notification_prefs))
      })
  }, [userId])

  async function save(updated: import('@/types').NotificationPrefs) {
    setSaving(true)
    await supabase.from('users').update({ notification_prefs: updated }).eq('id', userId)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  function toggle(key: keyof import('@/types').NotificationPrefs) {
    if (!prefs) return
    const updated = { ...prefs, [key]: !prefs[key] }
    setPrefs(updated)
    save(updated)
  }

  function setNumber(key: keyof import('@/types').NotificationPrefs, val: number) {
    if (!prefs) return
    const updated = { ...prefs, [key]: val }
    setPrefs(updated)
  }

  function commitNumber(key: keyof import('@/types').NotificationPrefs) {
    if (prefs) save(prefs)
  }

  function NotifToggle({ k }: { k: 'followup_enabled' | 'noshow_followup_enabled' | 'payment_enabled' | 'upsell_enabled' | 'daily_digest_enabled' | 'testimonial_enabled' | 'referral_enabled' }) {
    const on = prefs?.[k] ?? true
    return <Toggle on={!!on} onClick={() => toggle(k)} />
  }

  function NumberInput({ k, min, max, unit }: { k: 'followup_days' | 'followup_days_tier1' | 'followup_days_tier2' | 'followup_days_tier3' | 'overdue_days' | 'noshow_followup_days' | 'payment_days_before' | 'upsell_months' | 'testimonial_interval_months' | 'referral_interval_months'; min: number; max: number; unit: string }) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <input
          type="number"
          value={prefs?.[k] ?? 0}
          min={min}
          max={max}
          onChange={e => setNumber(k, Math.max(min, Math.min(max, Number(e.target.value))))}
          onBlur={() => commitNumber(k)}
          className="input-base"
          style={{ width: 60, textAlign: 'center' }}
        />
        <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{unit}</span>
      </div>
    )
  }

  if (!prefs) {
    return <p style={{ fontSize: 13, color: 'var(--text-3)', padding: '32px 0', textAlign: 'center' }}>Loading…</p>
  }

  const notifCard: React.CSSProperties = { ...CARD, marginBottom: 0 }
  const divider: React.CSSProperties = { borderTop: '1px solid var(--border)', paddingTop: 12, marginTop: 4 }
  const rowBetween: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {saved && (
        <div style={{
          padding: '8px 14px',
          background: 'rgba(22,163,74,0.07)',
          border: '1px solid rgba(22,163,74,0.2)',
          borderRadius: 'var(--radius-card)',
          fontSize: 12, color: 'var(--success)', fontWeight: 500,
        }}>
          Saved ✓
        </div>
      )}

      {/* Follow-ups */}
      <div style={notifCard}>
        <div style={rowBetween}>
          <div>
            <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-1)' }}>Follow-up tasks</p>
            <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>Creates a task when a lead hasn&apos;t been contacted in a while</p>
          </div>
          <NotifToggle k="followup_enabled" />
        </div>
        {prefs.followup_enabled && (
          <div style={{ ...divider, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <p className="label-caps">By lead tier</p>
            {[
              { label: 'Tier 1 — hot lead', k: 'followup_days_tier1' as const, min: 1, max: 14 },
              { label: 'Tier 2 — warm lead', k: 'followup_days_tier2' as const, min: 1, max: 21 },
              { label: 'Tier 3 — cold lead', k: 'followup_days_tier3' as const, min: 1, max: 30 },
            ].map(({ label, k, min, max }) => (
              <div key={k} style={rowBetween}>
                <span style={{ fontSize: 13, color: 'var(--text-1)' }}>{label}</span>
                <NumberInput k={k} min={min} max={max} unit="days" />
              </div>
            ))}
            <div style={{ ...rowBetween, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
              <span style={{ fontSize: 13, color: 'var(--text-1)' }}>Mark overdue after</span>
              <NumberInput k="overdue_days" min={1} max={60} unit="days" />
            </div>
          </div>
        )}
      </div>

      {/* No-show follow-up */}
      <div style={notifCard}>
        <div style={rowBetween}>
          <div>
            <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-1)' }}>No-show follow-up</p>
            <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>Creates a task to re-book when a lead no-showed, canceled, or rescheduled</p>
          </div>
          <NotifToggle k="noshow_followup_enabled" />
        </div>
        {prefs.noshow_followup_enabled && (
          <div style={{ ...divider, ...rowBetween }}>
            <span style={{ fontSize: 13, color: 'var(--text-1)' }}>Remind me after</span>
            <NumberInput k="noshow_followup_days" min={1} max={14} unit="days" />
          </div>
        )}
      </div>

      {/* Payments */}
      <div style={notifCard}>
        <div style={rowBetween}>
          <div>
            <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-1)' }}>Payment tasks</p>
            <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>Creates a task in your task list before each client payment is due</p>
          </div>
          <NotifToggle k="payment_enabled" />
        </div>
        {prefs.payment_enabled && (
          <div style={{ ...divider, ...rowBetween }}>
            <span style={{ fontSize: 13, color: 'var(--text-1)' }}>Remind me</span>
            <NumberInput k="payment_days_before" min={0} max={14} unit="days before due" />
          </div>
        )}
      </div>

      {/* Upsells */}
      <div style={notifCard}>
        <div style={rowBetween}>
          <div>
            <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-1)' }}>Upsell reminders</p>
            <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>Creates a task in your task list to reach out about renewing or upgrading</p>
          </div>
          <NotifToggle k="upsell_enabled" />
        </div>
        {prefs.upsell_enabled && (
          <div style={{ ...divider, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={rowBetween}>
              <span style={{ fontSize: 13, color: 'var(--text-1)' }}>Remind me</span>
              <NumberInput k="upsell_months" min={1} max={12} unit="month(s)" />
            </div>
            <div style={rowBetween}>
              <span style={{ fontSize: 13, color: 'var(--text-1)' }}>Timing</span>
              <select
                value={prefs.upsell_timing}
                onChange={e => {
                  const updated = { ...prefs, upsell_timing: e.target.value as import('@/types').UpsellTiming }
                  setPrefs(updated)
                  save(updated)
                }}
                className="input-base"
                style={{ width: 'auto', fontSize: 12 }}
              >
                <option value="after_start">after contract start</option>
                <option value="before_end">before contract end</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Testimonials */}
      <div style={notifCard}>
        <div style={rowBetween}>
          <div>
            <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-1)' }}>Testimonial reminders</p>
            <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>Reminds you to ask active clients for a testimonial on a regular schedule</p>
          </div>
          <NotifToggle k="testimonial_enabled" />
        </div>
        {prefs.testimonial_enabled && (
          <div style={{ ...divider, ...rowBetween }}>
            <span style={{ fontSize: 13, color: 'var(--text-1)' }}>Ask every</span>
            <NumberInput k="testimonial_interval_months" min={1} max={12} unit="month(s)" />
          </div>
        )}
      </div>

      {/* Referrals */}
      <div style={notifCard}>
        <div style={rowBetween}>
          <div>
            <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-1)' }}>Referral reminders</p>
            <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>Reminds you to ask active clients for referrals on a regular schedule</p>
          </div>
          <NotifToggle k="referral_enabled" />
        </div>
        {prefs.referral_enabled && (
          <div style={{ ...divider, ...rowBetween }}>
            <span style={{ fontSize: 13, color: 'var(--text-1)' }}>Ask every</span>
            <NumberInput k="referral_interval_months" min={1} max={12} unit="month(s)" />
          </div>
        )}
      </div>

      {/* Daily digest */}
      <div style={notifCard}>
        <div style={rowBetween}>
          <div>
            <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-1)' }}>Daily digest</p>
            <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>Shows a morning summary when you open the Tasks page — overdue, today&apos;s tasks, leads being watched</p>
          </div>
          <NotifToggle k="daily_digest_enabled" />
        </div>
      </div>
    </div>
  )
}

// ─── Section: Account ─────────────────────────────────────────────────────────

function LanguageSection({ userId, currentLanguage }: { userId: string; currentLanguage: string }) {
  const [lang, setLang] = useState(currentLanguage)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const t = useT()

  async function saveLang(newLang: string) {
    setLang(newLang)
    setSaving(true)
    await fetch('/api/settings/language', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ language: newLang }),
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    // Reload to re-fetch language from server
    window.location.reload()
  }

  return (
    <div style={CARD}>
      <p className="section-title" style={{ marginBottom: 4 }}>{t.settings.language}</p>
      <p style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 16 }}>
        {saving ? t.common.saving : saved ? 'Saved! Reloading…' : 'Choose your preferred language'}
      </p>
      <div style={{ display: 'flex', gap: 10 }}>
        {[
          { code: 'en', label: `🇬🇧 ${t.settings.english}` },
          { code: 'no', label: `🇳🇴 ${t.settings.norwegian}` },
        ].map(opt => (
          <button
            key={opt.code}
            onClick={() => { if (opt.code !== lang) saveLang(opt.code) }}
            style={{
              flex: 1, padding: '10px 0', borderRadius: 10, fontSize: 14, fontWeight: 600,
              cursor: 'pointer', border: '2px solid',
              borderColor: lang === opt.code ? 'var(--accent)' : 'var(--border)',
              background: lang === opt.code ? 'rgba(37,99,235,0.08)' : 'transparent',
              color: lang === opt.code ? 'var(--accent)' : 'var(--text-2)',
              transition: 'all 120ms',
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function AccountSection({ userId, userEmail, profile }: { userId: string; userEmail: string; profile: User }) {
  const [profileData, setProfileData] = useState({
    name: profile.name,
    business_name: profile.business_name,
    ig_handle: profile.ig_handle,
  })
  const [currency, setCurrency] = useState(profile.base_currency)
  const [adSpendCurrency, setAdSpendCurrency] = useState(profile.ad_spend_currency ?? profile.base_currency)
  const [liveRate, setLiveRate] = useState<number | null>(null)
  const [timezone, setTimezone] = useState(profile.timezone)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    if (adSpendCurrency !== currency) {
      getLiveRate(adSpendCurrency, currency).then(setLiveRate)
    } else {
      setLiveRate(null)
    }
  }, [adSpendCurrency, currency])

  async function saveProfile() {
    setSaving(true)
    await supabase.from('users').update(profileData).eq('id', userId)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function saveCurrency() {
    setSaving(true)
    await supabase.from('users').update({ base_currency: currency, ad_spend_currency: adSpendCurrency, timezone }).eq('id', userId)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Language */}
      <LanguageSection userId={userId} currentLanguage={profile.language ?? 'en'} />

      {/* Profile */}
      <div style={CARD}>
        <p className="section-title" style={{ marginBottom: 16 }}>Profile</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Email — read-only, from Supabase auth */}
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-2)', marginBottom: 6 }}>
              Email address
            </label>
            <div style={{
              padding: '9px 12px',
              borderRadius: 'var(--radius-input)',
              border: '1px solid var(--border)',
              background: 'var(--surface-2)',
              fontSize: 13,
              color: 'var(--text-2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
            }}>
              <span>{userEmail}</span>
              <span style={{ fontSize: 11, color: 'var(--text-3)', flexShrink: 0 }}>Login email</span>
            </div>
          </div>
          {[
            { key: 'name', label: 'Your name', placeholder: 'Alex' },
            { key: 'business_name', label: 'Business name', placeholder: 'Alex Coaching' },
            { key: 'ig_handle', label: 'Instagram handle', placeholder: '@alexcoach' },
          ].map(f => (
            <div key={f.key}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-2)', marginBottom: 6 }}>
                {f.label}
              </label>
              <input
                value={profileData[f.key as keyof typeof profileData]}
                onChange={e => setProfileData(d => ({ ...d, [f.key]: e.target.value }))}
                placeholder={f.placeholder}
                className="input-base"
              />
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
          <button
            onClick={saveProfile}
            disabled={saving}
            className="btn-primary"
            style={saved ? { background: 'var(--success)' } : undefined}
          >
            {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save changes'}
          </button>
        </div>
      </div>

      {/* Currency & region */}
      <div style={CARD}>
        <p className="section-title" style={{ marginBottom: 16 }}>Currency &amp; region</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-2)', marginBottom: 8 }}>
              Base currency
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
              {CURRENCIES.map(c => (
                <button
                  key={c.code}
                  onClick={() => setCurrency(c.code)}
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                    padding: '8px 6px',
                    borderRadius: 'var(--radius-card)',
                    border: currency === c.code ? '2px solid var(--accent)' : '2px solid var(--border)',
                    background: currency === c.code ? 'rgba(37,99,235,0.06)' : 'var(--surface-1)',
                    color: currency === c.code ? 'var(--accent)' : 'var(--text-2)',
                    fontSize: 11, fontWeight: 500,
                    cursor: 'pointer', transition: 'all 120ms ease',
                  }}
                >
                  <span style={{ fontSize: 16, marginBottom: 2 }}>{c.flag}</span>
                  {c.code}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-2)', marginBottom: 4 }}>
              Ad spend currency
            </label>
            <p style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 8 }}>
              Set the currency your ads platform charges in. Amounts are auto-converted to your base currency.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
              {CURRENCIES.map(c => (
                <button
                  key={c.code}
                  onClick={() => setAdSpendCurrency(c.code)}
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                    padding: '8px 6px',
                    borderRadius: 'var(--radius-card)',
                    border: adSpendCurrency === c.code ? '2px solid var(--accent)' : '2px solid var(--border)',
                    background: adSpendCurrency === c.code ? 'rgba(37,99,235,0.06)' : 'var(--surface-1)',
                    color: adSpendCurrency === c.code ? 'var(--accent)' : 'var(--text-2)',
                    fontSize: 11, fontWeight: 500,
                    cursor: 'pointer', transition: 'all 120ms ease',
                  }}
                >
                  <span style={{ fontSize: 16, marginBottom: 2 }}>{c.flag}</span>
                  {c.code}
                </button>
              ))}
            </div>
            {adSpendCurrency !== currency && liveRate !== null && (
              <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 8 }}>
                1 {adSpendCurrency} = {liveRate.toFixed(2)} {currency}
              </p>
            )}
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-2)', marginBottom: 6 }}>
              Timezone
            </label>
            <select
              value={timezone}
              onChange={e => setTimezone(e.target.value)}
              className="input-base"
            >
              {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
            </select>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
          <button
            onClick={saveCurrency}
            disabled={saving}
            className="btn-primary"
            style={saved ? { background: 'var(--success)' } : undefined}
          >
            {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save changes'}
          </button>
        </div>
      </div>

      {/* PWA install instructions */}
      <div style={CARD}>
        <p className="section-title" style={{ marginBottom: 4 }}>Add to home screen</p>
        <p style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 16 }}>Install Drivn on your device for the best experience.</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* iOS */}
          <div style={{
            padding: '12px 14px',
            background: 'var(--surface-2)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-card)',
          }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-1)', marginBottom: 4 }}>iPhone / iPad (Safari)</p>
            <p style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.5 }}>
              Tap the <strong>Share</strong> button (square with arrow) at the bottom of the screen, then tap <strong>&ldquo;Add to Home Screen&rdquo;</strong>.
            </p>
          </div>
          {/* Android */}
          <div style={{
            padding: '12px 14px',
            background: 'var(--surface-2)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-card)',
          }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-1)', marginBottom: 4 }}>Android (Chrome)</p>
            <p style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.5 }}>
              Tap the menu button (<strong>&#8942;</strong>) in the top-right corner, then tap <strong>&ldquo;Add to Home Screen&rdquo;</strong>.
            </p>
          </div>
        </div>
      </div>

      {/* Help */}
      <HelpCard />
    </div>
  )
}

// ─── Help card (walkthrough restart) ─────────────────────────────────────────

function HelpCard() {
  const { start } = useWalkthrough()
  const [restarted, setRestarted] = useState(false)

  const handleRestart = useCallback(() => {
    localStorage.removeItem('drivn_walkthrough_done')
    start()
    setRestarted(true)
    setTimeout(() => setRestarted(false), 2000)
  }, [start])

  return (
    <div style={{
      ...CARD,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 16,
    }}>
      <div>
        <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)', marginBottom: 2 }}>App tour</p>
        <p style={{ fontSize: 12, color: 'var(--text-3)', lineHeight: 1.4 }}>
          Restart the guided walkthrough to rediscover what each section does.
        </p>
      </div>
      <button
        onClick={handleRestart}
        style={{
          flexShrink: 0,
          fontSize: 13,
          fontWeight: 600,
          padding: '8px 14px',
          borderRadius: 8,
          border: '1px solid var(--neon-indigo)',
          background: restarted ? 'var(--neon-indigo)' : 'transparent',
          color: restarted ? '#fff' : 'var(--neon-indigo)',
          cursor: 'pointer',
          transition: 'all 150ms ease',
          whiteSpace: 'nowrap',
        }}
      >
        {restarted ? 'Starting…' : 'Restart tour'}
      </button>
    </div>
  )
}

// ─── Section: Check-ins ───────────────────────────────────────────────────────

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function CheckinsSection({ userId }: { userId: string }) {
  const supabase = createClient()
  const [enabled, setEnabled] = useState(true)
  const [day, setDay] = useState(0)
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    supabase.from('users').select('checkin_enabled, checkin_day').eq('id', userId).single()
      .then(({ data }) => {
        if (data) {
          const d = data as { checkin_enabled: boolean | null; checkin_day: number | null }
          setEnabled(d.checkin_enabled !== false)
          setDay(d.checkin_day ?? 0)
        }
        setLoaded(true)
      })
  }, [userId])

  async function save(newEnabled: boolean, newDay: number) {
    setSaving(true)
    await supabase.from('users').update({ checkin_enabled: newEnabled, checkin_day: newDay }).eq('id', userId)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  if (!loaded) {
    return <p style={{ fontSize: 13, color: 'var(--text-3)', padding: '32px 0', textAlign: 'center' }}>Loading…</p>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {saved && (
        <div style={{
          padding: '8px 14px',
          background: 'rgba(22,163,74,0.07)',
          border: '1px solid rgba(22,163,74,0.2)',
          borderRadius: 'var(--radius-card)',
          fontSize: 12, color: 'var(--success)', fontWeight: 500,
        }}>
          Saved ✓
        </div>
      )}

      <div style={CARD}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: enabled ? 16 : 0 }}>
          <div>
            <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-1)' }}>Weekly check-in enabled</p>
            <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>Show a weekly check-in prompt on your dashboard</p>
          </div>
          <Toggle
            on={enabled}
            onClick={() => {
              const newVal = !enabled
              setEnabled(newVal)
              save(newVal, day)
            }}
          />
        </div>

        {enabled && (
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
            <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-2)', marginBottom: 10 }}>Check-in day</p>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {DAY_LABELS.map((label, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setDay(i)
                    save(enabled, i)
                  }}
                  disabled={saving}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 'var(--radius-btn)',
                    border: day === i ? 'none' : '1px solid var(--border)',
                    background: day === i ? 'var(--accent)' : 'var(--surface-2)',
                    color: day === i ? '#fff' : 'var(--text-2)',
                    fontSize: 12, fontWeight: day === i ? 600 : 400,
                    cursor: saving ? 'not-allowed' : 'pointer',
                    transition: 'all 120ms ease',
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div style={{ ...CARD, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-1)' }}>Past check-ins</p>
          <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>View your check-in history and happiness trend</p>
        </div>
        <a
          href="/checkins"
          style={{
            fontSize: 13, fontWeight: 500, color: 'var(--accent)',
            textDecoration: 'none', flexShrink: 0,
          }}
        >
          View →
        </a>
      </div>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const NAV_ITEMS: { key: Section; label: string }[] = [
  { key: 'targets', label: 'KPI targets' },
  { key: 'setters', label: 'Setters' },
  { key: 'integrations', label: 'Integrations' },
  { key: 'notifications', label: 'Notifications' },
  { key: 'checkins', label: 'Check-ins' },
  { key: 'account', label: 'Account' },
]

export default function SettingsClient({ userId, userEmail, isAdmin = false, profile, targets, setters, secondaryCurrencies, initialSection, calendlyResult, calendlyErrorStep, calendlyErrorDetail }: Props) {
  const t = useT()
  const [section, setSection] = useState<Section>(initialSection ?? 'targets')
  const [navHover, setNavHover] = useState<Section | null>(null)
  const [expandedSection, setExpandedSection] = useState<Section | null>('targets')

  function renderSection(key: Section) {
    switch (key) {
      case 'targets':      return <TargetsSection userId={userId} targets={targets} baseCurrency={profile.base_currency} />
      case 'setters':      return <SettersSection userId={userId} initialSetters={setters} />
      case 'integrations': return <IntegrationsSection calendlyResult={calendlyResult} calendlyErrorStep={calendlyErrorStep} calendlyErrorDetail={calendlyErrorDetail} />
      case 'notifications': return <NotificationsSection userId={userId} />
      case 'checkins':     return <CheckinsSection userId={userId} />
      case 'account':      return <AccountSection userId={userId} userEmail={userEmail} profile={profile} />
    }
  }

  return (
    <div style={{ display: 'flex', height: '100%' }}>
      {/* Left nav — desktop only */}
      <div className="hidden md:flex" style={{
        flexDirection: 'column',
        width: 192,
        borderRight: '1px solid var(--border)',
        padding: '24px 12px',
        flexShrink: 0,
      }}>
        <h1 className="page-title" style={{ paddingLeft: 12, marginBottom: 16 }}>{t.settings.title}</h1>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {NAV_ITEMS.map(item => {
            const isActive = section === item.key
            const isHovered = navHover === item.key
            return (
              <button
                key={item.key}
                onClick={() => setSection(item.key)}
                onMouseEnter={() => setNavHover(item.key)}
                onMouseLeave={() => setNavHover(null)}
                style={{
                  width: '100%', textAlign: 'left',
                  padding: '7px 12px',
                  borderRadius: 'var(--radius-btn)',
                  border: 'none',
                  borderLeft: isActive ? '2px solid var(--accent)' : '2px solid transparent',
                  background: isActive ? 'var(--surface-2)' : isHovered ? 'var(--surface-2)' : 'transparent',
                  color: isActive ? 'var(--accent)' : 'var(--text-2)',
                  fontSize: 13, fontWeight: isActive ? 500 : 400,
                  cursor: 'pointer',
                  transition: 'background 120ms ease, color 120ms ease',
                }}
              >
                {item.label}
              </button>
            )
          })}
          {isAdmin && (
            <>
              <div style={{ height: 1, background: 'var(--border)', margin: '8px 4px' }} />
              <a
                href="/admin"
                style={{
                  display: 'block',
                  width: '100%', textAlign: 'left',
                  padding: '7px 12px',
                  borderRadius: 'var(--radius-btn)',
                  borderLeft: '2px solid #7C3AED',
                  background: 'rgba(124,58,237,0.08)',
                  color: '#7C3AED',
                  fontSize: 13, fontWeight: 500,
                  textDecoration: 'none',
                  transition: 'background 120ms ease',
                }}
              >
                🛡 Admin panel
              </a>
            </>
          )}
        </nav>
      </div>

      {/* Desktop content panel */}
      <div className="hidden md:block" style={{ flex: 1, overflowY: 'auto', padding: 24, paddingBottom: 88, maxWidth: 640 }}>
        {renderSection(section)}
      </div>

      {/* Mobile accordion — full width, all sections inline */}
      <div className="md:hidden" style={{ flex: 1, overflowY: 'auto', paddingBottom: 88 }}>
        {/* Page title */}
        <div style={{ padding: '16px 16px 4px', borderBottom: '1px solid var(--border)' }}>
          <h1 className="page-title">Settings</h1>
        </div>
        {NAV_ITEMS.map(item => (
          <div key={item.key} style={{ borderBottom: '1px solid var(--border)' }}>
            {/* Section header — 48px, tappable */}
            <button
              onClick={() => setExpandedSection(expandedSection === item.key ? null : item.key)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0 16px',
                height: 48,
                background: 'var(--bg-base)',
                border: 'none',
                cursor: 'pointer',
                fontSize: 14,
                fontWeight: 600,
                color: 'var(--text-1)',
                textAlign: 'left',
              }}
            >
              <span>{item.label}</span>
              <span style={{
                transition: 'transform 200ms',
                transform: expandedSection === item.key ? 'rotate(180deg)' : 'rotate(0deg)',
                color: 'var(--text-2)',
                fontSize: 12,
              }}>▼</span>
            </button>
            {/* Section content — shown when expanded */}
            {expandedSection === item.key && (
              <div style={{ padding: '0 16px 20px', background: 'var(--bg-base)' }}>
                {renderSection(item.key)}
              </div>
            )}
          </div>
        ))}
        {isAdmin && (
          <div style={{ borderBottom: '1px solid var(--border)' }}>
            <a
              href="/admin"
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0 16px',
                height: 48,
                background: 'rgba(124,58,237,0.06)',
                fontSize: 14,
                fontWeight: 600,
                color: '#7C3AED',
                textDecoration: 'none',
              }}
            >
              <span>🛡 Admin panel</span>
              <span style={{ fontSize: 12, color: '#7C3AED', opacity: 0.7 }}>→</span>
            </a>
          </div>
        )}
      </div>
    </div>
  )
}
