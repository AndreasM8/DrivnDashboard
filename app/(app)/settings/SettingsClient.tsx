'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import type { KpiTargets, Setter, User, SecondaryCurrency, SetterRole } from '@/types'
import { CURRENCIES, TIMEZONES, resolveNotifPrefs } from '@/types'
import { useDarkMode } from '@/components/providers/DarkModeProvider'
import IntegrationGuide, { type GuideStep } from './IntegrationGuide'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  userId: string
  profile: User
  targets: KpiTargets | null
  setters: Setter[]
  secondaryCurrencies: SecondaryCurrency[]
  initialSection?: Section
  calendlyResult?: 'error' | 'ok'
  calendlyErrorStep?: string
  calendlyErrorDetail?: string
}

type Section = 'targets' | 'setters' | 'integrations' | 'notifications' | 'account' | 'appearance'

// ─── Section: KPI Targets ─────────────────────────────────────────────────────

function TargetsSection({ userId, targets }: { userId: string; targets: KpiTargets | null }) {
  const [values, setValues] = useState({
    cash_target: String(targets?.cash_target ?? ''),
    revenue_target: String(targets?.revenue_target ?? ''),
    clients_target: String(targets?.clients_target ?? ''),
    meetings_target: String(targets?.meetings_target ?? ''),
    followers_target: String(targets?.followers_target ?? ''),
    close_rate_target: String(targets?.close_rate_target ?? ''),
    show_up_target: String(targets?.show_up_target ?? ''),
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function handleSave() {
    setSaving(true)
    const supabase = createClient()
    await supabase.from('kpi_targets').upsert({
      user_id: userId,
      ...Object.fromEntries(
        Object.entries(values).map(([k, v]) => [k, v ? Number(v) : null])
      ),
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const groups = [
    {
      title: 'Revenue',
      fields: [
        { key: 'cash_target', label: 'Monthly cash target', unit: 'NOK' },
        { key: 'revenue_target', label: 'Monthly revenue contracted', unit: 'NOK' },
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
      title: 'Call quality',
      fields: [
        { key: 'close_rate_target', label: 'Close rate target', unit: '%' },
        { key: 'show_up_target', label: 'Show-up rate target', unit: '%' },
      ],
    },
  ] as { title: string; fields: { key: keyof typeof values; label: string; unit: string }[] }[]

  return (
    <div className="space-y-6">
      {groups.map(g => (
        <div key={g.title} className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 p-5">
          <h3 className="font-semibold text-gray-900 dark:text-slate-100 mb-4">{g.title}</h3>
          <div className="space-y-4">
            {g.fields.map(f => (
              <div key={f.key} className="flex items-center gap-4">
                <label className="flex-1 text-sm text-gray-700 dark:text-slate-300">{f.label}</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={values[f.key]}
                    onChange={e => setValues(v => ({ ...v, [f.key]: e.target.value }))}
                    placeholder="—"
                    className="w-28 px-3 py-2 border border-gray-200 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-lg text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-xs text-gray-400 dark:text-slate-500 w-16">{f.unit}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className={`px-6 py-2.5 rounded-xl text-sm font-medium transition-all ${
            saved ? 'bg-green-600 text-white' : 'bg-blue-600 text-white hover:bg-blue-700'
          } disabled:opacity-50`}
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
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 p-5">
      <h3 className="font-semibold text-gray-900 dark:text-slate-100 mb-4">Your team</h3>

      <div className="space-y-3 mb-5">
        {setters.map(s => (
          <div key={s.id} className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-bold flex-shrink-0">
              {s.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900 dark:text-slate-100">{s.name}{s.is_self && <span className="ml-1 text-xs text-gray-400 dark:text-slate-500">(you)</span>}</p>
            </div>
            <select
              value={s.role}
              onChange={e => updateRole(s.id, e.target.value as SetterRole)}
              className="px-3 py-1.5 border border-gray-200 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="setter">Setter</option>
              <option value="closer">Closer</option>
              <option value="both">Both</option>
            </select>
            {!s.is_self && (
              confirmRemove === s.id ? (
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-gray-500 dark:text-slate-400">Remove?</span>
                  <button onClick={() => removeSetters(s.id)} className="text-xs font-semibold text-red-600 hover:text-red-700">Yes</button>
                  <button onClick={() => setConfirmRemove(null)} className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmRemove(s.id)}
                  className="text-gray-300 dark:text-slate-600 hover:text-red-500 transition-colors"
                >
                  <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                    <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </button>
              )
            )}
          </div>
        ))}
      </div>

      <div className="border-t border-gray-50 dark:border-slate-700 pt-4">
        <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 mb-3">Add person</p>
        <div className="flex gap-2">
          <input
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="Name"
            className="flex-1 px-3 py-2 border border-gray-200 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            onKeyDown={e => e.key === 'Enter' && addSetter()}
          />
          <select
            value={newRole}
            onChange={e => setNewRole(e.target.value as SetterRole)}
            className="px-3 py-2 border border-gray-200 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="setter">Setter</option>
            <option value="closer">Closer</option>
            <option value="both">Both</option>
          </select>
          <button
            onClick={addSetter}
            disabled={adding || !newName.trim()}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
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
      className="px-2 py-1 rounded text-xs font-medium bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors flex-shrink-0"
    >
      {copied ? '✓ Copied' : 'Copy'}
    </button>
  )
}

function WebhookCard({
  emoji, name, desc, configured, webhookUrl, instructions, docsUrl,
}: {
  emoji: string
  name: string
  desc: string
  configured: boolean
  webhookUrl: string
  instructions: string[]
  docsUrl?: string
}) {
  const [open, setOpen] = useState(false)

  return (
    <div className={`bg-white dark:bg-slate-800 rounded-xl border p-4 transition-all ${configured ? 'border-green-200 dark:border-green-800' : 'border-gray-100 dark:border-slate-700'}`}>
      <div className="flex items-start gap-4">
        <span className="text-2xl mt-0.5">{emoji}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
            <p className="font-medium text-gray-900 dark:text-slate-100 text-sm">{name}</p>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400 flex-shrink-0">Optional</span>
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${configured ? 'bg-green-500' : 'bg-gray-300 dark:bg-slate-600'}`} />
            <span className={`text-xs ${configured ? 'text-green-600 dark:text-green-400' : 'text-gray-400 dark:text-slate-500'}`}>
              {configured ? 'Configured' : 'Not set up'}
            </span>
          </div>
          <p className="text-xs text-gray-500 dark:text-slate-400">{desc}</p>

          {/* Webhook URL */}
          <div className="mt-3 flex items-center gap-2">
            <code className="flex-1 text-xs bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded px-2 py-1.5 text-gray-700 dark:text-slate-300 truncate">
              {webhookUrl}
            </code>
            <CopyButton value={webhookUrl} />
          </div>

          {/* Setup instructions */}
          <button
            onClick={() => setOpen(o => !o)}
            className="mt-2 text-xs text-blue-600 dark:text-blue-400 hover:underline"
          >
            {open ? 'Hide setup steps ↑' : 'How to set up ↓'}
          </button>

          {open && (
            <ol className="mt-2 space-y-1 pl-4 list-decimal">
              {instructions.map((step, i) => (
                <li key={i} className="text-xs text-gray-600 dark:text-slate-400">{step}</li>
              ))}
              {docsUrl && (
                <li className="text-xs">
                  <a href={docsUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                    Open platform →
                  </a>
                </li>
              )}
            </ol>
          )}
        </div>
      </div>
    </div>
  )
}

interface IntegrationStatus {
  zapier: { configured: boolean; webhook_url: string }
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
    // Surface any background-sync error from localStorage
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
    <div className={`bg-white dark:bg-slate-800 rounded-xl border p-4 transition-all ${status.connected ? 'border-green-200 dark:border-green-800' : 'border-gray-100 dark:border-slate-700'}`}>
      <div className="flex items-start gap-4">
        <span className="text-2xl mt-0.5">📊</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <p className="font-medium text-gray-900 dark:text-slate-100 text-sm">Google Sheets</p>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400 flex-shrink-0">Optional</span>
            {!loading && (
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${status.connected ? 'bg-green-500' : 'bg-gray-300 dark:bg-slate-600'}`} />
            )}
          </div>
          <p className="text-xs text-gray-500 dark:text-slate-400">
            Syncs your pipeline, revenue, and KPIs to a Google Sheet automatically. Skip this and track manually instead.
          </p>

          {!status.connected && !loading && (
            <ol className="mt-2 text-xs text-gray-500 dark:text-slate-400 space-y-1 list-decimal list-inside">
              <li>Click <span className="font-medium text-gray-700 dark:text-slate-300">Connect Google</span> → sign in with the Google account where you want the sheet</li>
              <li>Click <span className="font-medium text-gray-700 dark:text-slate-300">Allow</span> when Google asks for spreadsheet access</li>
              <li>Done — Drivn creates a spreadsheet in your Drive and starts syncing automatically</li>
            </ol>
          )}

          {status.connected && (
            <div className="mt-2 space-y-1">
              {status.spreadsheet_url && (
                <a
                  href={status.spreadsheet_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline block truncate"
                >
                  Open spreadsheet →
                </a>
              )}
              {status.last_synced_at && !syncError && (
                <p className="text-xs text-gray-400 dark:text-slate-500">Last synced {formatSynced(status.last_synced_at)}</p>
              )}
              {syncError && (
                <p className="text-xs text-rose-500 dark:text-rose-400">⚠ Last sync failed: {syncError}</p>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2 flex-shrink-0">
          {loading ? (
            <span className="text-xs text-gray-400 dark:text-slate-500 py-2">Loading…</span>
          ) : status.connected ? (
            <>
              <button
                onClick={handleSync}
                disabled={syncing}
                className="px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {syncing ? 'Syncing…' : 'Sync now'}
              </button>
              <button
                onClick={handleDisconnect}
                disabled={disconnecting}
                className="px-3 py-1.5 bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300 text-xs font-medium rounded-lg hover:bg-gray-200 dark:hover:bg-slate-600 disabled:opacity-50"
              >
                {disconnecting ? 'Removing…' : 'Disconnect'}
              </button>
            </>
          ) : (
            <a
              href="/api/google/auth"
              className="px-4 py-2 bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-300 text-sm font-medium rounded-lg hover:bg-gray-200 dark:hover:bg-slate-600 text-center whitespace-nowrap"
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
        {/* Sidebar */}
        <div className="w-36 bg-white dark:bg-slate-800 border-r border-gray-200 dark:border-slate-700 flex flex-col py-3 px-2 gap-0.5">
          <div className="flex items-center gap-1.5 px-2 py-1.5 mb-2">
            <div className="w-5 h-5 rounded bg-indigo-600 flex items-center justify-center">
              <span className="text-white font-bold" style={{ fontSize: 9 }}>S</span>
            </div>
            <span className="text-xs font-bold text-gray-800 dark:text-slate-100">Stripe</span>
          </div>
          {['Home', 'Payments', 'Customers'].map(item => (
            <div key={item} className="px-2 py-1 rounded text-xs text-gray-500 dark:text-slate-400">{item}</div>
          ))}
          <div className="px-2 py-1 rounded text-xs font-semibold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-900/40 flex items-center gap-1.5">
            Developers
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse flex-shrink-0" />
          </div>
        </div>
        {/* Main area placeholder */}
        <div className="flex-1 bg-gray-50 dark:bg-slate-900 flex items-center justify-center">
          <span className="text-xs text-gray-300 dark:text-slate-600">Select Developers →</span>
        </div>
      </div>
    ),
  },
  {
    title: 'Click Webhooks → Add endpoint',
    description: 'Inside Developers, click "Webhooks" in the sub-menu, then hit "Add endpoint" in the top right.',
    visual: (
      <div className="flex flex-col w-full h-full bg-white dark:bg-slate-800 p-3">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-bold text-gray-800 dark:text-slate-100">Webhooks</span>
          <div className="relative px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-medium ring-2 ring-indigo-300 ring-offset-1 dark:ring-offset-slate-800 animate-pulse">
            + Add endpoint
          </div>
        </div>
        <div className="border border-gray-100 dark:border-slate-700 rounded-lg divide-y divide-gray-50 dark:divide-slate-700">
          {['https://example.com/webhook', 'https://old-hook.io/stripe'].map(u => (
            <div key={u} className="px-3 py-2 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-400 flex-shrink-0" />
              <span className="text-xs text-gray-500 dark:text-slate-400 truncate">{u}</span>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    title: 'Paste your endpoint URL',
    description: 'Paste the webhook URL from above into the "Endpoint URL" field, then continue.',
    visual: (
      <div className="flex flex-col w-full h-full bg-white dark:bg-slate-800 justify-center p-4 gap-3">
        <div>
          <label className="block text-xs font-semibold text-gray-600 dark:text-slate-300 mb-1">Endpoint URL</label>
          <div className="flex items-center gap-1.5 px-3 py-2 border-2 border-indigo-400 rounded-lg bg-indigo-50 dark:bg-indigo-900/20">
            <span className="text-xs text-gray-700 dark:text-slate-300 truncate flex-1 font-mono">
              https://yourdomain.com/api/webhooks/stripe
            </span>
            <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5 text-gray-400 flex-shrink-0">
              <rect x="1" y="4" width="9" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
              <path d="M5 4V3a1 1 0 011-1h7a1 1 0 011 1v9a1 1 0 01-1 1h-1" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          </div>
        </div>
        <p className="text-xs text-indigo-600 dark:text-indigo-400">Paste the URL copied from Drivn above</p>
      </div>
    ),
  },
  {
    title: 'Select payment events',
    description: 'Under "Select events", search and check both payment events shown below.',
    visual: (
      <div className="flex flex-col w-full h-full bg-white dark:bg-slate-800 justify-center p-4 gap-2">
        <label className="text-xs font-semibold text-gray-600 dark:text-slate-300 mb-1">Select events to listen to</label>
        <div className="flex items-center gap-2 px-2 py-1.5 border border-gray-200 dark:border-slate-600 rounded-lg mb-1">
          <svg viewBox="0 0 16 16" className="w-3 h-3 text-gray-400 flex-shrink-0">
            <circle cx="6.5" cy="6.5" r="5" stroke="currentColor" strokeWidth="1.5" />
            <path d="M10 10l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <span className="text-xs text-gray-400 dark:text-slate-500">Search events…</span>
        </div>
        {[
          'payment_intent.succeeded',
          'payment_intent.payment_failed',
        ].map(ev => (
          <div key={ev} className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
            <svg viewBox="0 0 16 16" className="w-3.5 h-3.5 text-green-600 dark:text-green-400 flex-shrink-0">
              <rect x="1" y="1" width="14" height="14" rx="3" fill="currentColor" opacity="0.15" />
              <path d="M4 8l3 3 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="text-xs font-mono text-green-800 dark:text-green-300">{ev}</span>
          </div>
        ))}
      </div>
    ),
  },
  {
    title: 'Copy the signing secret',
    description: 'After saving the endpoint, click "Reveal" next to Signing secret and copy the whsec_… value.',
    visual: (
      <div className="flex flex-col w-full h-full bg-white dark:bg-slate-800 justify-center p-4 gap-2">
        <label className="text-xs font-semibold text-gray-600 dark:text-slate-300 mb-1">Signing secret</label>
        <div className="flex items-center gap-2 px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg bg-gray-50 dark:bg-slate-700">
          <span className="flex-1 text-xs font-mono text-gray-400 dark:text-slate-500 tracking-widest select-none blur-[3px]">
            whsec_••••••••••••••••••
          </span>
          <div className="px-2 py-1 rounded bg-indigo-600 text-white text-xs font-medium ring-2 ring-indigo-300 dark:ring-indigo-700 animate-pulse flex-shrink-0">
            Reveal
          </div>
        </div>
        <p className="text-xs text-gray-400 dark:text-slate-500">Copy the revealed secret → paste it into Drivn below</p>
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
    <div className={`bg-white dark:bg-slate-800 rounded-xl border p-4 transition-all ${connected ? 'border-green-200 dark:border-green-800' : 'border-gray-100 dark:border-slate-700'}`}>
      <div className="flex items-start gap-4">
        <span className="text-2xl mt-0.5">💳</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <p className="font-medium text-gray-900 dark:text-slate-100 text-sm">Stripe</p>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400 flex-shrink-0">Optional</span>
            {!loading && (
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${connected ? 'bg-green-500' : 'bg-gray-300 dark:bg-slate-600'}`} />
            )}
          </div>
          <p className="text-xs text-gray-500 dark:text-slate-400">Auto-marks payments when clients pay. Skip this and mark payments manually in the client profile.</p>

          {!connected && !showInput && (
            <div className="mt-3 space-y-2">
              <ol className="text-xs text-gray-500 dark:text-slate-400 space-y-1.5 list-decimal list-inside">
                <li>Log into <span className="font-medium text-gray-700 dark:text-slate-300">dashboard.stripe.com</span> → click <span className="font-medium text-gray-700 dark:text-slate-300">Developers</span> in the left sidebar</li>
                <li>Click <span className="font-medium text-gray-700 dark:text-slate-300">Webhooks</span> → then <span className="font-medium text-gray-700 dark:text-slate-300">Add endpoint</span> (top right)</li>
                <li>Paste the URL below into the <span className="font-medium text-gray-700 dark:text-slate-300">Endpoint URL</span> field</li>
                <li>Under <span className="font-medium text-gray-700 dark:text-slate-300">Select events</span>, search and add: <span className="font-mono text-gray-700 dark:text-slate-300">payment_intent.succeeded</span> and <span className="font-mono text-gray-700 dark:text-slate-300">payment_intent.payment_failed</span></li>
                <li>Click <span className="font-medium text-gray-700 dark:text-slate-300">Add endpoint</span> → on the next screen, click <span className="font-medium text-gray-700 dark:text-slate-300">Reveal</span> next to Signing secret</li>
                <li>Copy the <span className="font-mono text-gray-700 dark:text-slate-300">whsec_…</span> value → paste it below and click Connect</li>
              </ol>
              <div className="flex items-center gap-2 mt-2">
                <code className="flex-1 text-xs bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded px-2 py-1.5 truncate text-gray-600 dark:text-slate-300">{webhookUrl}</code>
                <button onClick={copyUrl} className="px-2 py-1.5 text-xs bg-gray-100 dark:bg-slate-700 dark:text-slate-300 rounded hover:bg-gray-200 dark:hover:bg-slate-600 flex-shrink-0">
                  {copied ? '✓' : 'Copy'}
                </button>
              </div>
              {!showGuide && (
                <button
                  onClick={() => setShowGuide(true)}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline mt-1"
                >
                  Show me how →
                </button>
              )}
              {showGuide && (
                <IntegrationGuide steps={stripeSteps} onClose={() => setShowGuide(false)} />
              )}
            </div>
          )}

          {showInput && (
            <div className="mt-3 space-y-2">
              <p className="text-xs text-gray-600 dark:text-slate-400">Paste your Stripe signing secret (starts with <span className="font-mono">whsec_</span>):</p>
              <div className="flex gap-2">
                <input
                  type="password"
                  value={secret}
                  onChange={e => setSecret(e.target.value)}
                  placeholder="whsec_..."
                  className="flex-1 text-xs border border-gray-200 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={handleSave}
                  disabled={saving || !secret.trim()}
                  className="px-3 py-2 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? 'Saving…' : 'Save'}
                </button>
                <button onClick={() => setShowInput(false)} className="px-3 py-2 text-xs text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200">
                  Cancel
                </button>
              </div>
            </div>
          )}

          {connected && (
            <p className="text-xs text-green-600 dark:text-green-400 mt-2 font-medium">✓ Connected — payments sync automatically</p>
          )}
        </div>

        <div className="flex-shrink-0">
          {loading ? (
            <span className="text-xs text-gray-400 dark:text-slate-500">Loading…</span>
          ) : connected ? (
            <button onClick={handleDisconnect} className="px-3 py-1.5 bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300 text-xs font-medium rounded-lg hover:bg-gray-200 dark:hover:bg-slate-600">
              Disconnect
            </button>
          ) : !showInput ? (
            <button onClick={() => setShowInput(true)} className="px-4 py-2 bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-300 text-sm font-medium rounded-lg hover:bg-gray-200 dark:hover:bg-slate-600">
              Connect
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function CalendlyCard({ oauthResult, errorStep, errorDetail }: { oauthResult?: 'error' | 'ok'; errorStep?: string; errorDetail?: string }) {
  const [connected, setConnected] = useState(false)
  const [loading, setLoading] = useState(true)
  const [userName, setUserName] = useState<string | null>(null)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [userUri, setUserUri] = useState<string | null>(null)
  const [connectedAt, setConnectedAt] = useState<string | null>(null)
  const [disconnecting, setDisconnecting] = useState(false)

  useEffect(() => {
    fetch('/api/calendly/status')
      .then(r => r.json())
      .then(d => {
        setConnected(d.connected)
        setUserName(d.userName ?? null)
        setUserEmail(d.userEmail ?? null)
        setUserUri(d.userUri ?? null)
        setConnectedAt(d.connectedAt ?? null)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  async function handleDisconnect() {
    setDisconnecting(true)
    await fetch('/api/calendly/status', { method: 'DELETE' })
    setConnected(false)
    setUserName(null)
    setUserEmail(null)
    setUserUri(null)
    setConnectedAt(null)
    setDisconnecting(false)
  }

  // Extract a readable ID from the URI: https://api.calendly.com/users/XXXX → XXXX
  const accountId = userUri ? userUri.split('/').pop() : null

  const showError = oauthResult === 'error'

  return (
    <div className={`bg-white dark:bg-slate-800 rounded-xl border p-4 transition-all ${
      showError ? 'border-rose-200 dark:border-rose-800' :
      connected ? 'border-green-200 dark:border-green-800' :
      'border-gray-100 dark:border-slate-700'
    }`}>
      <div className="flex items-start gap-4">
        <span className="text-2xl mt-0.5">📅</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <p className="font-medium text-gray-900 dark:text-slate-100 text-sm">Calendly</p>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400 flex-shrink-0">Optional</span>
            {!loading && !showError && <span className={`w-2 h-2 rounded-full flex-shrink-0 ${connected ? 'bg-green-500' : 'bg-gray-300 dark:bg-slate-600'}`} />}
            {showError && <span className="w-2 h-2 rounded-full flex-shrink-0 bg-rose-500" />}
          </div>
          <p className="text-xs text-gray-500 dark:text-slate-400">
            Auto-moves followers to &apos;Call booked&apos; when they book. Skip this and move them manually in the pipeline.
          </p>

          {/* OAuth error banner */}
          {showError && (
            <div className="mt-3 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800/40 rounded-lg px-3 py-2.5 space-y-1">
              <p className="text-xs font-semibold text-rose-700 dark:text-rose-400">
                Connection failed{errorStep ? ` — step: ${errorStep}` : ''}
              </p>
              {errorDetail && (
                <p className="text-[11px] font-mono text-rose-600 dark:text-rose-400/80 break-all">{errorDetail}</p>
              )}
              <p className="text-xs text-rose-600 dark:text-rose-400/80">
                {connected ? 'Click Disconnect below, then try connecting again.' : 'Click Connect Calendly to try again.'}
              </p>
            </div>
          )}

          {connected && !showError && (
            <div className="mt-3 space-y-1">
              <p className="text-xs text-green-600 dark:text-green-400 font-medium">Connected — bookings sync automatically</p>
              <p className="text-xs text-gray-500 dark:text-slate-400">
                {userName
                  ? <><span className="font-medium text-gray-700 dark:text-slate-300">{userName}</span>{userEmail && ` · ${userEmail}`}</>
                  : accountId
                    ? <span className="font-mono">Account: {accountId}</span>
                    : 'Account details unavailable'
                }
              </p>
              {connectedAt && (
                <p className="text-[11px] text-gray-400 dark:text-slate-500">
                  Connected {new Date(connectedAt).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })}
                </p>
              )}
              <p className="text-[11px] text-gray-400 dark:text-slate-500 mt-1">
                Not the right account? Click Disconnect and reconnect after logging into the correct Calendly account.
              </p>
            </div>
          )}

          {!connected && !loading && !showError && (
            <div className="mt-3">
              <ol className="text-xs text-gray-500 dark:text-slate-400 space-y-1.5 list-decimal list-inside">
                <li>Click <span className="font-medium text-gray-700 dark:text-slate-300">Connect Calendly</span> → you&apos;ll be taken to Calendly to sign in</li>
                <li>Click <span className="font-medium text-gray-700 dark:text-slate-300">Allow</span> when Calendly asks for permission</li>
                <li>Done — bookings will automatically move leads to <span className="font-medium text-gray-700 dark:text-slate-300">Call booked</span></li>
              </ol>
            </div>
          )}
        </div>

        <div className="flex-shrink-0 flex flex-col items-end gap-2">
          {loading ? (
            <span className="text-xs text-gray-400 dark:text-slate-500">Loading…</span>
          ) : connected ? (
            <>
              <button
                onClick={handleDisconnect}
                disabled={disconnecting}
                className="px-3 py-1.5 bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300 text-xs font-medium rounded-lg hover:bg-gray-200 dark:hover:bg-slate-600 disabled:opacity-50"
              >
                {disconnecting ? 'Disconnecting…' : 'Disconnect'}
              </button>
              {showError && (
                <a
                  href="/api/calendly/oauth/start"
                  className="px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 text-center"
                >
                  Reconnect
                </a>
              )}
            </>
          ) : (
            <a
              href="/api/calendly/oauth/start"
              className="px-4 py-2 bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-300 text-sm font-medium rounded-lg hover:bg-gray-200 dark:hover:bg-slate-600 text-center whitespace-nowrap"
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
    <div className="space-y-3">
      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800/40 rounded-xl px-4 py-3 text-xs text-amber-700 dark:text-amber-400">
        All integrations are <strong>optional</strong>. You can skip them and add leads, mark payments, and move pipeline stages manually at any time.
      </div>

      <WebhookCard
        emoji="⚡"
        name="ManyChat"
        desc="Automatically adds new followers to your pipeline when they DM you. Uses ManyChat's built-in HTTP action — no Zapier needed. Skip this and add followers manually instead."
        configured={status?.zapier.configured ?? false}
        webhookUrl={zapierUrl}
        instructions={[
          'In ManyChat, open the flow you use for new DMs → click the + button to add a step → choose Actions → Send Request',
          'Set Method to POST, paste the URL above into the URL field, set Content Type to JSON',
          'In the Request Body, add: { "ig_username": "{{last name}}", "full_name": "{{full name}}", "source": "manychat" } → Save and publish the flow',
        ]}
        docsUrl="https://manychat.com"
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

  function Toggle({ k }: { k: 'followup_enabled' | 'call_outcome_enabled' | 'payment_enabled' | 'upsell_enabled' | 'daily_digest_enabled' }) {
    const on = prefs?.[k] ?? true
    return (
      <button
        onClick={() => toggle(k)}
        className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${on ? 'bg-blue-600' : 'bg-gray-200 dark:bg-slate-600'}`}
      >
        <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${on ? 'translate-x-6' : 'translate-x-1'}`} />
      </button>
    )
  }

  function NumberInput({ k, min, max, unit }: { k: 'followup_days' | 'followup_days_tier1' | 'followup_days_tier2' | 'followup_days_tier3' | 'overdue_days' | 'call_outcome_hours' | 'payment_days_before' | 'upsell_months'; min: number; max: number; unit: string }) {
    return (
      <div className="flex items-center gap-2">
        <input
          type="number"
          value={prefs?.[k] ?? 0}
          min={min}
          max={max}
          onChange={e => setNumber(k, Math.max(min, Math.min(max, Number(e.target.value))))}
          onBlur={() => commitNumber(k)}
          className="w-14 px-2 py-1 text-sm text-center border border-gray-200 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <span className="text-xs text-gray-400 dark:text-slate-500">{unit}</span>
      </div>
    )
  }

  if (!prefs) {
    return <div className="text-sm text-gray-400 dark:text-slate-500 py-8 text-center">Loading…</div>
  }

  return (
    <div className="space-y-4">
      {saved && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/40 rounded-xl px-4 py-2.5 text-xs text-green-700 dark:text-green-400 font-medium">
          Saved ✓
        </div>
      )}

      {/* Follow-ups */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold text-gray-900 dark:text-slate-100">Follow-up tasks</p>
            <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">Creates a task when a lead hasn&apos;t been contacted in a while</p>
          </div>
          <Toggle k="followup_enabled" />
        </div>
        {prefs.followup_enabled && (
          <div className="space-y-3 border-t border-gray-100 dark:border-slate-700 pt-3">
            <p className="text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wide">By lead tier</p>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-sm text-gray-700 dark:text-slate-300">
                <span className="text-base">🔥</span> Tier 1 — hot lead
              </span>
              <NumberInput k="followup_days_tier1" min={1} max={14} unit="days" />
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-sm text-gray-700 dark:text-slate-300">
                <span className="text-base">💪</span> Tier 2 — warm lead
              </span>
              <NumberInput k="followup_days_tier2" min={1} max={21} unit="days" />
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-sm text-gray-700 dark:text-slate-300">
                <span className="text-base">🌱</span> Tier 3 — cold lead
              </span>
              <NumberInput k="followup_days_tier3" min={1} max={30} unit="days" />
            </div>
            <div className="flex items-center justify-between border-t border-gray-100 dark:border-slate-700 pt-3">
              <span className="text-sm text-gray-700 dark:text-slate-300">Mark overdue after</span>
              <NumberInput k="overdue_days" min={1} max={60} unit="days" />
            </div>
          </div>
        )}
      </div>

      {/* Call outcome */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold text-gray-900 dark:text-slate-100">Log call outcome</p>
            <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">Reminds you to log what happened after a call</p>
          </div>
          <Toggle k="call_outcome_enabled" />
        </div>
        {prefs.call_outcome_enabled && (
          <div className="flex items-center justify-between border-t border-gray-100 dark:border-slate-700 pt-3">
            <span className="text-sm text-gray-700 dark:text-slate-300">Remind me</span>
            <NumberInput k="call_outcome_hours" min={0} max={24} unit="hours after call" />
          </div>
        )}
      </div>

      {/* Payments */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold text-gray-900 dark:text-slate-100">Payment tasks</p>
            <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">Creates a task in your task list before each client payment is due</p>
          </div>
          <Toggle k="payment_enabled" />
        </div>
        {prefs.payment_enabled && (
          <div className="flex items-center justify-between border-t border-gray-100 dark:border-slate-700 pt-3">
            <span className="text-sm text-gray-700 dark:text-slate-300">Remind me</span>
            <NumberInput k="payment_days_before" min={0} max={14} unit="days before due" />
          </div>
        )}
      </div>

      {/* Upsells */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold text-gray-900 dark:text-slate-100">Upsell reminders</p>
            <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">Creates a task in your task list to reach out about renewing or upgrading</p>
          </div>
          <Toggle k="upsell_enabled" />
        </div>
        {prefs.upsell_enabled && (
          <div className="space-y-3 border-t border-gray-100 dark:border-slate-700 pt-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-700 dark:text-slate-300">Remind me</span>
              <NumberInput k="upsell_months" min={1} max={12} unit="month(s)" />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-700 dark:text-slate-300">Timing</span>
              <select
                value={prefs.upsell_timing}
                onChange={e => {
                  const updated = { ...prefs, upsell_timing: e.target.value as import('@/types').UpsellTiming }
                  setPrefs(updated)
                  save(updated)
                }}
                className="text-sm border border-gray-200 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="after_start">after contract start</option>
                <option value="before_end">before contract end</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Daily digest */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold text-gray-900 dark:text-slate-100">Daily digest</p>
            <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">Shows a morning summary when you open the Tasks page — overdue, today&apos;s tasks, leads being watched</p>
          </div>
          <Toggle k="daily_digest_enabled" />
        </div>
      </div>
    </div>
  )
}

// ─── Section: Account ─────────────────────────────────────────────────────────

function AccountSection({ userId, profile }: { userId: string; profile: User }) {
  const [profileData, setProfileData] = useState({
    name: profile.name,
    business_name: profile.business_name,
    ig_handle: profile.ig_handle,
  })
  const [currency, setCurrency] = useState(profile.base_currency)
  const [timezone, setTimezone] = useState(profile.timezone)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const supabase = createClient()

  async function saveProfile() {
    setSaving(true)
    await supabase.from('users').update(profileData).eq('id', userId)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function saveCurrency() {
    setSaving(true)
    await supabase.from('users').update({ base_currency: currency, timezone }).eq('id', userId)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="space-y-4">
      {/* Profile */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 p-5">
        <h3 className="font-semibold text-gray-900 dark:text-slate-100 mb-4">Profile</h3>
        <div className="space-y-3">
          {[
            { key: 'name', label: 'Your name', placeholder: 'Alex' },
            { key: 'business_name', label: 'Business name', placeholder: 'Alex Coaching' },
            { key: 'ig_handle', label: 'Instagram handle', placeholder: '@alexcoach' },
          ].map(f => (
            <div key={f.key}>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">{f.label}</label>
              <input
                value={profileData[f.key as keyof typeof profileData]}
                onChange={e => setProfileData(d => ({ ...d, [f.key]: e.target.value }))}
                placeholder={f.placeholder}
                className="w-full px-3 py-2.5 border border-gray-200 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          ))}
        </div>
        <div className="flex justify-end mt-4">
          <button onClick={saveProfile} disabled={saving} className={`px-5 py-2 rounded-xl text-sm font-medium ${saved ? 'bg-green-600 text-white' : 'bg-blue-600 text-white hover:bg-blue-700'} disabled:opacity-50`}>
            {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save changes'}
          </button>
        </div>
      </div>

      {/* Currency & region */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 p-5">
        <h3 className="font-semibold text-gray-900 dark:text-slate-100 mb-4">Currency & region</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">Base currency</label>
            <div className="grid grid-cols-4 gap-2">
              {CURRENCIES.map(c => (
                <button
                  key={c.code}
                  onClick={() => setCurrency(c.code)}
                  className={`flex flex-col items-center p-2 rounded-xl border-2 text-xs font-medium transition-all ${
                    currency === c.code ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' : 'border-gray-100 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-700 dark:text-slate-300 hover:border-gray-200 dark:hover:border-slate-500'
                  }`}
                >
                  <span className="text-base mb-0.5">{c.flag}</span>
                  {c.code}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Timezone</label>
            <select
              value={timezone}
              onChange={e => setTimezone(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-200 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
            </select>
          </div>
        </div>
        <div className="flex justify-end mt-4">
          <button onClick={saveCurrency} disabled={saving} className={`px-5 py-2 rounded-xl text-sm font-medium ${saved ? 'bg-green-600 text-white' : 'bg-blue-600 text-white hover:bg-blue-700'} disabled:opacity-50`}>
            {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Section: Appearance ──────────────────────────────────────────────────────

function AppearanceSection() {
  const { dark, toggle } = useDarkMode()

  return (
    <div className="space-y-4">
      {/* Dark mode toggle */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 p-5">
        <h3 className="font-semibold text-gray-900 dark:text-slate-100 mb-4">Appearance</h3>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-700 dark:text-slate-300">Dark mode</p>
            <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">Switch between light and dark theme</p>
          </div>
          <button
            onClick={toggle}
            aria-pressed={dark}
            className={`relative w-12 h-6 rounded-full transition-colors ${dark ? 'bg-blue-600' : 'bg-gray-200'}`}
          >
            <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${dark ? 'translate-x-7' : 'translate-x-1'}`} />
          </button>
        </div>
      </div>

      {/* PWA install instructions */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 p-5">
        <h3 className="font-semibold text-gray-900 dark:text-slate-100 mb-1">Add to home screen</h3>
        <p className="text-xs text-gray-500 dark:text-slate-400 mb-4">Install Drivn on your device for the best experience.</p>
        <div className="space-y-3">
          {/* iOS */}
          <div className="rounded-lg bg-gray-50 dark:bg-slate-700/50 border border-gray-100 dark:border-slate-600 p-4">
            <p className="text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">iPhone / iPad (Safari)</p>
            <p className="text-xs text-gray-500 dark:text-slate-400">
              Tap the <strong>Share</strong> button (square with arrow) at the bottom of the screen, then tap <strong>&ldquo;Add to Home Screen&rdquo;</strong>.
            </p>
          </div>
          {/* Android */}
          <div className="rounded-lg bg-gray-50 dark:bg-slate-700/50 border border-gray-100 dark:border-slate-600 p-4">
            <p className="text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">Android (Chrome)</p>
            <p className="text-xs text-gray-500 dark:text-slate-400">
              Tap the menu button (<strong>&#8942;</strong>) in the top-right corner, then tap <strong>&ldquo;Add to Home Screen&rdquo;</strong>.
            </p>
          </div>
        </div>
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
  { key: 'account', label: 'Account' },
  { key: 'appearance', label: 'Appearance' },
]

export default function SettingsClient({ userId, profile, targets, setters, secondaryCurrencies, initialSection, calendlyResult, calendlyErrorStep, calendlyErrorDetail }: Props) {
  const [section, setSection] = useState<Section>(initialSection ?? 'targets')

  return (
    <div className="flex h-full">
      {/* Left nav */}
      <div className="hidden md:flex flex-col w-48 border-r border-gray-100 dark:border-slate-700 bg-white dark:bg-slate-900 py-6 px-3 flex-shrink-0">
        <h1 className="text-lg font-bold text-gray-900 dark:text-slate-100 px-3 mb-4">Settings</h1>
        <nav className="space-y-0.5">
          {NAV_ITEMS.map(item => (
            <button
              key={item.key}
              onClick={() => setSection(item.key)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                section === item.key ? 'bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300' : 'text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800'
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Mobile section nav */}
      <div className="md:hidden border-b border-gray-100 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3 overflow-x-auto flex gap-2">
        {NAV_ITEMS.map(item => (
          <button
            key={item.key}
            onClick={() => setSection(item.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap ${section === item.key ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300' : 'text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800'}`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 max-w-2xl">
        {section === 'targets' && <TargetsSection userId={userId} targets={targets} />}
        {section === 'setters' && <SettersSection userId={userId} initialSetters={setters} />}
        {section === 'integrations' && <IntegrationsSection calendlyResult={calendlyResult} calendlyErrorStep={calendlyErrorStep} calendlyErrorDetail={calendlyErrorDetail} />}
        {section === 'notifications' && <NotificationsSection userId={userId} />}
        {section === 'account' && <AccountSection userId={userId} profile={profile} />}
        {section === 'appearance' && <AppearanceSection />}
      </div>
    </div>
  )
}
