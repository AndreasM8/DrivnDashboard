'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import type { KpiTargets, Setter, User, SecondaryCurrency, SetterRole } from '@/types'
import { CURRENCIES, TIMEZONES } from '@/types'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  userId: string
  profile: User
  targets: KpiTargets | null
  setters: Setter[]
  secondaryCurrencies: SecondaryCurrency[]
  initialSection?: Section
}

type Section = 'targets' | 'setters' | 'integrations' | 'notifications' | 'account'

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
        <div key={g.title} className="bg-white rounded-xl border border-gray-100 p-5">
          <h3 className="font-semibold text-gray-900 mb-4">{g.title}</h3>
          <div className="space-y-4">
            {g.fields.map(f => (
              <div key={f.key} className="flex items-center gap-4">
                <label className="flex-1 text-sm text-gray-700">{f.label}</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={values[f.key]}
                    onChange={e => setValues(v => ({ ...v, [f.key]: e.target.value }))}
                    placeholder="—"
                    className="w-28 px-3 py-2 border border-gray-200 rounded-lg text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-xs text-gray-400 w-16">{f.unit}</span>
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

  async function removeSetters(id: string) {
    await supabase.from('setters').update({ active: false }).eq('id', id)
    setSetters(ss => ss.filter(s => s.id !== id))
  }

  async function updateRole(id: string, role: SetterRole) {
    await supabase.from('setters').update({ role }).eq('id', id)
    setSetters(ss => ss.map(s => s.id === id ? { ...s, role } : s))
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5">
      <h3 className="font-semibold text-gray-900 mb-4">Your team</h3>

      <div className="space-y-3 mb-5">
        {setters.map(s => (
          <div key={s.id} className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-bold flex-shrink-0">
              {s.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900">{s.name}{s.is_self && <span className="ml-1 text-xs text-gray-400">(you)</span>}</p>
            </div>
            <select
              value={s.role}
              onChange={e => updateRole(s.id, e.target.value as SetterRole)}
              className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="setter">Setter</option>
              <option value="closer">Closer</option>
              <option value="both">Both</option>
            </select>
            {!s.is_self && (
              <button
                onClick={() => removeSetters(s.id)}
                className="text-gray-300 hover:text-red-500 transition-colors"
              >
                <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                  <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="border-t border-gray-50 pt-4">
        <p className="text-xs font-semibold text-gray-500 mb-3">Add person</p>
        <div className="flex gap-2">
          <input
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="Name"
            className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            onKeyDown={e => e.key === 'Enter' && addSetter()}
          />
          <select
            value={newRole}
            onChange={e => setNewRole(e.target.value as SetterRole)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
      className="px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors flex-shrink-0"
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
    <div className={`bg-white rounded-xl border p-4 transition-all ${configured ? 'border-green-200' : 'border-gray-100'}`}>
      <div className="flex items-start gap-4">
        <span className="text-2xl mt-0.5">{emoji}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <p className="font-medium text-gray-900 text-sm">{name}</p>
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${configured ? 'bg-green-500' : 'bg-gray-300'}`} />
            <span className={`text-xs ${configured ? 'text-green-600' : 'text-gray-400'}`}>
              {configured ? 'Configured' : 'Not set up'}
            </span>
          </div>
          <p className="text-xs text-gray-500">{desc}</p>

          {/* Webhook URL */}
          <div className="mt-3 flex items-center gap-2">
            <code className="flex-1 text-xs bg-gray-50 border border-gray-200 rounded px-2 py-1.5 text-gray-700 truncate">
              {webhookUrl}
            </code>
            <CopyButton value={webhookUrl} />
          </div>

          {/* Setup instructions */}
          <button
            onClick={() => setOpen(o => !o)}
            className="mt-2 text-xs text-blue-600 hover:underline"
          >
            {open ? 'Hide setup steps ↑' : 'How to set up ↓'}
          </button>

          {open && (
            <ol className="mt-2 space-y-1 pl-4 list-decimal">
              {instructions.map((step, i) => (
                <li key={i} className="text-xs text-gray-600">{step}</li>
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
  const [disconnecting, setDisconnecting] = useState(false)

  useEffect(() => {
    fetch('/api/google/status')
      .then(r => r.json())
      .then(d => setStatus(d))
      .finally(() => setLoading(false))
  }, [])

  async function handleSync() {
    setSyncing(true)
    const res = await fetch('/api/google/sync', { method: 'POST' })
    if (res.ok) {
      const data = await res.json()
      setStatus(s => ({
        ...s,
        connected: true,
        spreadsheet_url: data.spreadsheetUrl ?? s.spreadsheet_url,
        last_synced_at: new Date().toISOString(),
      }))
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
    const d = new Date(iso)
    return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className={`bg-white rounded-xl border p-4 transition-all ${status.connected ? 'border-green-200' : 'border-gray-100'}`}>
      <div className="flex items-start gap-4">
        <span className="text-2xl mt-0.5">📊</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-medium text-gray-900 text-sm">Google Sheets</p>
            {!loading && (
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${status.connected ? 'bg-green-500' : 'bg-gray-300'}`} />
            )}
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            Syncs your leads, clients, and tasks to a Google Sheet you own.
          </p>

          {status.connected && (
            <div className="mt-2 space-y-1">
              {status.spreadsheet_url && (
                <a
                  href={status.spreadsheet_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-600 hover:underline block truncate"
                >
                  Open spreadsheet →
                </a>
              )}
              {status.last_synced_at && (
                <p className="text-xs text-gray-400">Last synced {formatSynced(status.last_synced_at)}</p>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2 flex-shrink-0">
          {loading ? (
            <span className="text-xs text-gray-400 py-2">Loading…</span>
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
                className="px-3 py-1.5 bg-gray-100 text-gray-600 text-xs font-medium rounded-lg hover:bg-gray-200 disabled:opacity-50"
              >
                {disconnecting ? 'Removing…' : 'Disconnect'}
              </button>
            </>
          ) : (
            <a
              href="/api/google/auth"
              className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 text-center"
            >
              Connect
            </a>
          )}
        </div>
      </div>
    </div>
  )
}

function IntegrationsSection() {
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
      <WebhookCard
        emoji="⚡"
        name="Zapier"
        desc="One webhook URL connects everything — ManyChat leads, Stripe payments, and any other tool you use in Zapier."
        configured={status?.zapier.configured ?? false}
        webhookUrl={zapierUrl}
        instructions={[
          'In Zapier, open any Zap (ManyChat, Stripe, or any trigger)',
          'Add action: Webhooks by Zapier → POST',
          'Paste the URL above → Save → Done',
        ]}
        docsUrl="https://zapier.com"
      />

      <WebhookCard
        emoji="💳"
        name="Stripe"
        desc="Automatically log payments and failed charges when they happen in Stripe."
        configured={status?.stripe.configured ?? false}
        webhookUrl={stripeUrl}
        instructions={[
          'Go to Stripe Dashboard → Developers → Webhooks',
          'Click "Add destination" → My account → Endpoint',
          'Give it a name and paste the URL above',
          'Add events: payment_intent.succeeded + payment_intent.payment_failed → Save',
        ]}
        docsUrl="https://dashboard.stripe.com/webhooks"
      />

      <GoogleSheetsCard />
    </div>
  )
}

// ─── Section: Notifications ───────────────────────────────────────────────────

function NotificationsSection() {
  const [settings, setSettings] = useState({
    followup_48hr: true,
    followup_weekly: true,
    followup_monthly: true,
    followup_bimonthly: true,
    payment_overdue: true,
    invoice_reminder: true,
    call_outcome: true,
    upsell_reminder: true,
  })

  function toggle(key: keyof typeof settings) {
    setSettings(s => ({ ...s, [key]: !s[key] }))
  }

  const groups = [
    {
      title: 'Follow-up cadence',
      items: [
        { key: 'followup_48hr', label: '48hr first follow-up' },
        { key: 'followup_weekly', label: 'Weekly follow-up (weeks 1-8)' },
        { key: 'followup_monthly', label: 'Monthly check-in (months 3-8)' },
        { key: 'followup_bimonthly', label: 'Every 2 months (ongoing)' },
      ],
    },
    {
      title: 'Payments',
      items: [
        { key: 'payment_overdue', label: 'Payment overdue alert' },
        { key: 'invoice_reminder', label: 'Invoice due in 3 days' },
      ],
    },
    {
      title: 'Calls & upsells',
      items: [
        { key: 'call_outcome', label: 'Log call outcome reminder' },
        { key: 'upsell_reminder', label: 'Upsell reminder' },
      ],
    },
  ] as { title: string; items: { key: keyof typeof settings; label: string }[] }[]

  return (
    <div className="space-y-4">
      {groups.map(g => (
        <div key={g.title} className="bg-white rounded-xl border border-gray-100 p-5">
          <h3 className="font-semibold text-gray-900 mb-4">{g.title}</h3>
          <div className="space-y-3">
            {g.items.map(item => (
              <div key={item.key} className="flex items-center justify-between">
                <span className="text-sm text-gray-700">{item.label}</span>
                <button
                  onClick={() => toggle(item.key)}
                  className={`relative w-12 h-6 rounded-full transition-colors ${settings[item.key] ? 'bg-blue-600' : 'bg-gray-200'}`}
                >
                  <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${settings[item.key] ? 'translate-x-7' : 'translate-x-1'}`} />
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}
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
      <div className="bg-white rounded-xl border border-gray-100 p-5">
        <h3 className="font-semibold text-gray-900 mb-4">Profile</h3>
        <div className="space-y-3">
          {[
            { key: 'name', label: 'Your name', placeholder: 'Alex' },
            { key: 'business_name', label: 'Business name', placeholder: 'Alex Coaching' },
            { key: 'ig_handle', label: 'Instagram handle', placeholder: '@alexcoach' },
          ].map(f => (
            <div key={f.key}>
              <label className="block text-sm font-medium text-gray-700 mb-1">{f.label}</label>
              <input
                value={profileData[f.key as keyof typeof profileData]}
                onChange={e => setProfileData(d => ({ ...d, [f.key]: e.target.value }))}
                placeholder={f.placeholder}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
      <div className="bg-white rounded-xl border border-gray-100 p-5">
        <h3 className="font-semibold text-gray-900 mb-4">Currency & region</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Base currency</label>
            <div className="grid grid-cols-4 gap-2">
              {CURRENCIES.map(c => (
                <button
                  key={c.code}
                  onClick={() => setCurrency(c.code)}
                  className={`flex flex-col items-center p-2 rounded-xl border-2 text-xs font-medium transition-all ${
                    currency === c.code ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-100 bg-white text-gray-700 hover:border-gray-200'
                  }`}
                >
                  <span className="text-base mb-0.5">{c.flag}</span>
                  {c.code}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Timezone</label>
            <select
              value={timezone}
              onChange={e => setTimezone(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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

// ─── Main ─────────────────────────────────────────────────────────────────────

const NAV_ITEMS: { key: Section; label: string }[] = [
  { key: 'targets', label: 'KPI targets' },
  { key: 'setters', label: 'Setters' },
  { key: 'integrations', label: 'Integrations' },
  { key: 'notifications', label: 'Notifications' },
  { key: 'account', label: 'Account' },
]

export default function SettingsClient({ userId, profile, targets, setters, secondaryCurrencies, initialSection }: Props) {
  const [section, setSection] = useState<Section>(initialSection ?? 'targets')

  return (
    <div className="flex h-full">
      {/* Left nav */}
      <div className="hidden md:flex flex-col w-48 border-r border-gray-100 bg-white py-6 px-3 flex-shrink-0">
        <h1 className="text-lg font-bold text-gray-900 px-3 mb-4">Settings</h1>
        <nav className="space-y-0.5">
          {NAV_ITEMS.map(item => (
            <button
              key={item.key}
              onClick={() => setSection(item.key)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                section === item.key ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Mobile section nav */}
      <div className="md:hidden border-b border-gray-100 bg-white px-4 py-3 overflow-x-auto flex gap-2">
        {NAV_ITEMS.map(item => (
          <button
            key={item.key}
            onClick={() => setSection(item.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap ${section === item.key ? 'bg-blue-100 text-blue-700' : 'text-gray-500 hover:bg-gray-100'}`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 max-w-2xl">
        {section === 'targets' && <TargetsSection userId={userId} targets={targets} />}
        {section === 'setters' && <SettersSection userId={userId} initialSetters={setters} />}
        {section === 'integrations' && <IntegrationsSection />}
        {section === 'notifications' && <NotificationsSection />}
        {section === 'account' && <AccountSection userId={userId} profile={profile} />}
      </div>
    </div>
  )
}
