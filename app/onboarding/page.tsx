'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { CURRENCIES, TIMEZONES } from '@/types'
import { getLiveRate } from '@/lib/exchange-rates-client'

// ─── Types ────────────────────────────────────────────────────────────────────

interface SecondaryCurrencyInput {
  currency_code: string
  label: string
  estimated_monthly: number
  rate?: number
}

interface OnboardingData {
  // Step 2
  name: string
  business_name: string
  ig_handle: string
  timezone: string
  // Step 3
  base_currency: string
  secondary_currencies: SecondaryCurrencyInput[]
  // Step 4
  team_mode: 'solo' | 'team'
  setters: { name: string; role: 'setter' | 'closer' | 'both' }[]
  // Step 5
  cash_target: string
  clients_target: string
  meetings_target: string
  followers_target: string
  close_rate_target: string
  show_up_target: string
  // Step 6
  uses_manychat: boolean
  uses_zapier: boolean
  uses_stripe: boolean
}

const DEFAULTS: OnboardingData = {
  name: '', business_name: '', ig_handle: '', timezone: 'Europe/Oslo',
  base_currency: 'NOK',
  secondary_currencies: [{ currency_code: 'AED', label: 'Meta ads', estimated_monthly: 500 }],
  team_mode: 'solo', setters: [],
  cash_target: '75000', clients_target: '5', meetings_target: '25',
  followers_target: '200', close_rate_target: '25', show_up_target: '60',
  uses_manychat: false, uses_zapier: false, uses_stripe: false,
}

// ─── Progress bar ─────────────────────────────────────────────────────────────

function ProgressBar({ step, total }: { step: number; total: number }) {
  return (
    <div className="w-full h-1 bg-gray-100 rounded-full overflow-hidden">
      <div
        className="h-full bg-blue-500 rounded-full transition-all duration-500"
        style={{ width: `${(step / total) * 100}%` }}
      />
    </div>
  )
}

// ─── Step 1: Welcome ──────────────────────────────────────────────────────────

function Step1({ onNext }: { onNext: () => void }) {
  return (
    <div className="text-center">
      <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
        <span className="text-white text-2xl font-bold">D</span>
      </div>
      <h1 className="text-2xl font-bold text-gray-900 mb-3">Your business, finally in one place</h1>
      <p className="text-gray-500 mb-8">Drivn replaces your Google Sheets, sticky notes, and scattered DMs with one simple system.</p>

      <div className="space-y-3 text-left mb-10">
        {[
          { icon: '📊', title: 'Pipeline', desc: 'Track every lead from follower to signed client' },
          { icon: '✅', title: 'Tasks', desc: 'Know exactly what to do every single day' },
          { icon: '💰', title: 'Numbers', desc: 'See your revenue, close rate, and KPIs at a glance' },
        ].map(f => (
          <div key={f.title} className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl">
            <span className="text-xl">{f.icon}</span>
            <div>
              <p className="font-medium text-gray-900 text-sm">{f.title}</p>
              <p className="text-xs text-gray-500">{f.desc}</p>
            </div>
          </div>
        ))}
      </div>

      <button onClick={onNext} className="w-full bg-blue-600 text-white rounded-xl py-3 font-medium hover:bg-blue-700 transition-colors">
        Get started →
      </button>
    </div>
  )
}

// ─── Step 2: Profile ──────────────────────────────────────────────────────────

function Step2({ data, onChange, onNext, onBack }: StepProps) {
  return (
    <div>
      <h2 className="text-xl font-bold text-gray-900 mb-1">Tell us about you</h2>
      <p className="text-gray-500 text-sm mb-6">This appears in your dashboard and reports.</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        <Field label="Your name" value={data.name} onChange={v => onChange({ name: v })} placeholder="Alex" />
        <Field label="Business name" value={data.business_name} onChange={v => onChange({ business_name: v })} placeholder="Alex Coaching" />
        <Field label="Instagram handle" value={data.ig_handle} onChange={v => onChange({ ig_handle: v })} placeholder="@alexcoach" />
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Timezone</label>
          <select
            value={data.timezone}
            onChange={e => onChange({ timezone: e.target.value })}
            className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
          </select>
        </div>
      </div>

      <StepNav onBack={onBack} onNext={onNext} nextDisabled={!data.name} />
    </div>
  )
}

// ─── Step 3: Currency ─────────────────────────────────────────────────────────

function Step3({ data, onChange, onNext, onBack }: StepProps) {
  const [addCode, setAddCode] = useState('USD')
  const [addLabel, setAddLabel] = useState('')
  const [rates, setRates] = useState<Record<string, number>>({})

  async function addCurrency() {
    if (data.secondary_currencies.find(c => c.currency_code === addCode)) return
    const rate = await getLiveRate(addCode, data.base_currency).catch(() => 1)
    setRates(r => ({ ...r, [addCode]: rate }))
    onChange({
      secondary_currencies: [
        ...data.secondary_currencies,
        { currency_code: addCode, label: addLabel || addCode, estimated_monthly: 0, rate },
      ],
    })
    setAddLabel('')
  }

  function removeCurrency(code: string) {
    onChange({ secondary_currencies: data.secondary_currencies.filter(c => c.currency_code !== code) })
  }

  function updateEstimate(code: string, amount: number) {
    onChange({
      secondary_currencies: data.secondary_currencies.map(c =>
        c.currency_code === code ? { ...c, estimated_monthly: amount } : c
      ),
    })
  }

  return (
    <div>
      <h2 className="text-xl font-bold text-gray-900 mb-1">Currency & region</h2>
      <p className="text-gray-500 text-sm mb-6">All revenue will be shown in your base currency.</p>

      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">Base currency</label>
        <div className="grid grid-cols-4 gap-2">
          {CURRENCIES.map(c => (
            <button
              key={c.code}
              onClick={() => onChange({ base_currency: c.code })}
              className={`flex flex-col items-center p-2.5 rounded-xl border-2 text-sm font-medium transition-all ${
                data.base_currency === c.code
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-100 bg-white text-gray-700 hover:border-gray-200'
              }`}
            >
              <span className="text-lg mb-0.5">{c.flag}</span>
              <span>{c.code}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Secondary currencies <span className="text-gray-400 font-normal">(optional — e.g. if you spend on Meta ads in AED)</span>
        </label>

        {data.secondary_currencies.map(sc => (
          <div key={sc.currency_code} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl mb-2">
            <span className="text-lg">{CURRENCIES.find(c => c.code === sc.currency_code)?.flag ?? '💱'}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900">{sc.currency_code} — {sc.label}</p>
              {sc.rate && (
                <p className="text-xs text-gray-400">1 {sc.currency_code} ≈ {sc.rate.toFixed(2)} {data.base_currency}</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={sc.estimated_monthly || ''}
                onChange={e => updateEstimate(sc.currency_code, Number(e.target.value))}
                placeholder="Monthly spend"
                className="w-28 px-2 py-1.5 border border-gray-200 rounded-lg text-xs text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button onClick={() => removeCurrency(sc.currency_code)} className="text-gray-400 hover:text-red-500 transition-colors">
                <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          </div>
        ))}

        <div className="flex gap-2 mt-2">
          <select
            value={addCode}
            onChange={e => setAddCode(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {CURRENCIES.filter(c => c.code !== data.base_currency).map(c => (
              <option key={c.code} value={c.code}>{c.flag} {c.code}</option>
            ))}
          </select>
          <input
            value={addLabel}
            onChange={e => setAddLabel(e.target.value)}
            placeholder="Label (e.g. Meta ads)"
            className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={addCurrency}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
          >
            Add
          </button>
        </div>
      </div>

      <StepNav onBack={onBack} onNext={onNext} />
    </div>
  )
}

// ─── Step 4: Team ─────────────────────────────────────────────────────────────

function Step4({ data, onChange, onNext, onBack }: StepProps) {
  return (
    <div>
      <h2 className="text-xl font-bold text-gray-900 mb-1">How do you work?</h2>
      <p className="text-gray-500 text-sm mb-6">This helps us set up the right task flows.</p>

      <div className="space-y-3 mb-6">
        {[
          { value: 'solo', title: "I'm setting and closing myself", desc: "You handle all DMs and calls — solo mode, no team setup needed." },
          { value: 'team', title: 'I have setters or closers on my team', desc: 'You manage other people who run calls or DMs for you.' },
        ].map(opt => (
          <button
            key={opt.value}
            onClick={() => onChange({ team_mode: opt.value as 'solo' | 'team' })}
            className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
              data.team_mode === opt.value
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-100 bg-white hover:border-gray-200'
            }`}
          >
            <p className="font-medium text-gray-900 text-sm">{opt.title}</p>
            <p className="text-xs text-gray-500 mt-0.5">{opt.desc}</p>
          </button>
        ))}
      </div>

      {data.team_mode === 'team' && (
        <div className="mb-6">
          <p className="text-sm font-medium text-gray-700 mb-3">Add your team members</p>
          {data.setters.map((s, i) => (
            <div key={i} className="flex items-center gap-2 mb-2">
              <input
                value={s.name}
                onChange={e => {
                  const updated = [...data.setters]
                  updated[i] = { ...updated[i], name: e.target.value }
                  onChange({ setters: updated })
                }}
                placeholder="Name"
                className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <select
                value={s.role}
                onChange={e => {
                  const updated = [...data.setters]
                  updated[i] = { ...updated[i], role: e.target.value as 'setter' | 'closer' | 'both' }
                  onChange({ setters: updated })
                }}
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="setter">Setter</option>
                <option value="closer">Closer</option>
                <option value="both">Both</option>
              </select>
              <button
                onClick={() => onChange({ setters: data.setters.filter((_, j) => j !== i) })}
                className="text-gray-400 hover:text-red-500 transition-colors"
              >
                <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          ))}
          <button
            onClick={() => onChange({ setters: [...data.setters, { name: '', role: 'setter' }] })}
            className="text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            + Add person
          </button>
        </div>
      )}

      <StepNav onBack={onBack} onNext={onNext} />
      <button onClick={onNext} className="w-full text-center text-sm text-gray-400 hover:text-gray-600 mt-3 transition-colors">
        Skip this step
      </button>
    </div>
  )
}

// ─── Step 5: Targets ──────────────────────────────────────────────────────────

function Step5({ data, onChange, onNext, onBack }: StepProps) {
  const currency = data.base_currency

  const fields = [
    { key: 'cash_target', label: 'Cash target', unit: currency, placeholder: '75000' },
    { key: 'clients_target', label: 'New clients / month', unit: 'clients', placeholder: '5' },
    { key: 'meetings_target', label: 'Meetings booked', unit: 'meetings', placeholder: '25' },
    { key: 'followers_target', label: 'New followers', unit: 'followers', placeholder: '200' },
    { key: 'close_rate_target', label: 'Close rate', unit: '%', placeholder: '25' },
    { key: 'show_up_target', label: 'Show-up rate', unit: '%', placeholder: '60' },
  ] as const

  return (
    <div>
      <h2 className="text-xl font-bold text-gray-900 mb-1">Set your targets</h2>
      <p className="text-gray-500 text-sm mb-6">These are used to score your KPIs green, amber, or red. You can change them anytime.</p>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-8">
        {fields.map(f => (
          <div key={f.key}>
            <label className="block text-xs font-medium text-gray-600 mb-1">{f.label}</label>
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                value={data[f.key]}
                onChange={e => onChange({ [f.key]: e.target.value })}
                placeholder={f.placeholder}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-xs text-gray-400 whitespace-nowrap">{f.unit}</span>
            </div>
          </div>
        ))}
      </div>

      <StepNav onBack={onBack} onNext={onNext} />
    </div>
  )
}

// ─── Step 6: Integrations ─────────────────────────────────────────────────────

function CopyBtn({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
      className="px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 flex-shrink-0"
    >
      {copied ? '✓' : 'Copy'}
    </button>
  )
}

function SetupBox({ title, steps, url, urlLabel }: { title: string; steps: string[]; url?: string; urlLabel?: string }) {
  return (
    <div className="bg-blue-50 rounded-xl p-4 mb-4">
      <p className="text-sm font-semibold text-gray-900 mb-2">{title}</p>
      {url && (
        <div className="flex items-center gap-2 mb-3">
          <code className="flex-1 text-xs bg-white border border-blue-100 rounded px-2 py-1.5 text-gray-700 truncate">{url}</code>
          <CopyBtn value={url} />
        </div>
      )}
      {urlLabel && <p className="text-xs text-gray-500 mb-2">{urlLabel}</p>}
      <ol className="space-y-1 pl-4 list-decimal">
        {steps.map((s, i) => <li key={i} className="text-xs text-gray-600">{s}</li>)}
      </ol>
    </div>
  )
}

function Step6({ data, onChange, onNext, onBack }: StepProps) {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://yourapp.com'
  const webhookUrl = `${origin}/api/webhooks/zapier`
  const stripeUrl = `${origin}/api/webhooks/stripe`

  const noneSelected = !data.uses_manychat && !data.uses_zapier && !data.uses_stripe

  const tools = [
    { key: 'uses_manychat' as const, emoji: '💬', name: 'ManyChat', desc: 'Instagram DM automation' },
    { key: 'uses_zapier' as const, emoji: '⚡', name: 'Zapier', desc: 'Connects all your tools' },
    { key: 'uses_stripe' as const, emoji: '💳', name: 'Stripe', desc: 'Payment processing' },
  ]

  return (
    <div>
      <h2 className="text-xl font-bold text-gray-900 mb-1">Which tools do you use?</h2>
      <p className="text-gray-500 text-sm mb-5">Tick everything you already have — we'll show you the quickest way to connect.</p>

      {/* Tool selector */}
      <div className="grid grid-cols-3 gap-2 mb-6">
        {tools.map(t => (
          <button
            key={t.key}
            onClick={() => onChange({ [t.key]: !data[t.key] })}
            className={`flex flex-col items-center p-3 rounded-xl border-2 text-center transition-all ${
              data[t.key] ? 'border-blue-500 bg-blue-50' : 'border-gray-100 bg-white hover:border-gray-200'
            }`}
          >
            <span className="text-2xl mb-1">{t.emoji}</span>
            <p className="text-xs font-semibold text-gray-900">{t.name}</p>
            <p className="text-xs text-gray-400 mt-0.5">{t.desc}</p>
            {data[t.key] && <span className="mt-1.5 text-xs text-blue-600 font-medium">✓ Selected</span>}
          </button>
        ))}
      </div>

      {/* Tailored setup instructions */}
      {noneSelected && (
        <div className="bg-gray-50 rounded-xl p-4 mb-4 text-center">
          <p className="text-sm text-gray-600">No problem — you can add leads manually and connect tools later in Settings.</p>
        </div>
      )}

      {/* Has Zapier — one URL covers everything */}
      {data.uses_zapier && (
        <SetupBox
          title={data.uses_manychat ? "Zapier covers ManyChat + Stripe — one URL" : "Zapier — one URL for everything"}
          url={webhookUrl}
          urlLabel="Paste this into any Zap as a Webhooks by Zapier → POST action"
          steps={[
            'In Zapier, open a Zap (ManyChat, Stripe, or any trigger)',
            'Add action: Webhooks by Zapier → POST',
            'Paste the URL above',
            'Add header: x-zapier-secret → set a secret phrase, save it in Settings',
            data.uses_stripe ? 'Stripe payments can also route through this same Zap' : 'Done — leads will appear in your pipeline automatically',
          ]}
        />
      )}

      {/* Has ManyChat but NOT Zapier — direct connection */}
      {data.uses_manychat && !data.uses_zapier && (
        <SetupBox
          title="Connect ManyChat directly — no Zapier needed"
          url={webhookUrl}
          urlLabel="Paste this into ManyChat's External Request action"
          steps={[
            'In ManyChat, open your DM flow',
            'Add a step: Actions → External Request',
            'Method: POST, paste the URL above',
            'Add header: x-zapier-secret → set a secret phrase, save it in Settings',
            'Body: { "type": "new_lead", "data": { "ig_username": "{{user_instagram_handle}}" } }',
            'Save and publish — new subscribers appear in your pipeline instantly',
          ]}
        />
      )}

      {/* Has Stripe — show Stripe webhook (only if not using Zapier for it) */}
      {data.uses_stripe && !data.uses_zapier && (
        <SetupBox
          title="Connect Stripe directly"
          url={stripeUrl}
          urlLabel="Paste this into your Stripe Webhook settings"
          steps={[
            'Stripe Dashboard → Developers → Webhooks → Add endpoint',
            'Paste the URL above',
            'Select events: payment_intent.succeeded + payment_intent.payment_failed',
            'Copy the Signing secret and paste it into STRIPE_WEBHOOK_SECRET in .env.local',
          ]}
        />
      )}

      <StepNav onBack={onBack} onNext={onNext} nextLabel="Almost done →" />
      <button onClick={onNext} className="w-full text-center text-sm text-gray-400 hover:text-gray-600 mt-3 transition-colors">
        Skip — I'll do this later
      </button>
    </div>
  )
}

// ─── Step 7: Done ─────────────────────────────────────────────────────────────

function Step7({ data, onFinish, loading }: { data: OnboardingData; onFinish: () => void; loading: boolean }) {
  const checks = [
    { label: 'Profile set up', done: !!data.name },
    { label: 'Base currency selected', done: !!data.base_currency },
    { label: 'Targets set', done: !!data.cash_target },
    { label: 'ManyChat selected', done: data.uses_manychat },
    { label: 'Zapier selected', done: data.uses_zapier },
    { label: 'Stripe selected', done: data.uses_stripe },
  ].filter(c => c.label !== 'ManyChat selected' || data.uses_manychat || data.uses_zapier)
   .filter(c => c.label !== 'Zapier selected' || data.uses_zapier)
   .filter(c => c.label !== 'Stripe selected' || data.uses_stripe)

  const actions = [
    { n: 1, text: 'Add your first lead in Pipeline' },
    {
      n: 2,
      text: data.uses_zapier
        ? 'Finish Zapier setup in Settings → Integrations'
        : data.uses_manychat
        ? 'Finish ManyChat setup in Settings → Integrations'
        : 'Connect your tools anytime in Settings → Integrations',
    },
    { n: 3, text: 'Add your first client in Clients' },
  ]

  return (
    <div>
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-1">You&apos;re all set!</h2>
        <p className="text-gray-500 text-sm">Here&apos;s what&apos;s ready:</p>
      </div>

      <div className="space-y-2 mb-6">
        {checks.map(c => (
          <div key={c.label} className="flex items-center gap-3">
            <span className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${c.done ? 'bg-green-100 text-green-600' : 'bg-amber-100 text-amber-500'}`}>
              {c.done
                ? <svg viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                : <svg viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" /></svg>
              }
            </span>
            <span className={`text-sm ${c.done ? 'text-gray-700' : 'text-gray-400'}`}>{c.label}</span>
          </div>
        ))}
      </div>

      <div className="bg-blue-50 rounded-xl p-4 mb-8">
        <p className="text-sm font-semibold text-gray-900 mb-3">Your first 3 actions:</p>
        <ol className="space-y-2">
          {actions.map(a => (
            <li key={a.n} className="flex items-start gap-2 text-sm text-gray-700">
              <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{a.n}</span>
              {a.text}
            </li>
          ))}
        </ol>
      </div>

      <button
        onClick={onFinish}
        disabled={loading}
        className="w-full bg-blue-600 text-white rounded-xl py-3 font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
      >
        {loading ? 'Setting up…' : 'Go to my dashboard →'}
      </button>
    </div>
  )
}

// ─── Shared components ────────────────────────────────────────────────────────

interface StepProps {
  data: OnboardingData
  onChange: (partial: Partial<OnboardingData>) => void
  onNext: () => void
  onBack: () => void
}

function Field({
  label, value, onChange, placeholder,
}: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>
  )
}

function StepNav({
  onBack, onNext, nextDisabled = false, nextLabel = 'Continue →',
}: {
  onBack: () => void; onNext: () => void; nextDisabled?: boolean; nextLabel?: string
}) {
  return (
    <div className="flex gap-3">
      <button
        onClick={onBack}
        className="px-5 py-2.5 border border-gray-200 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors"
      >
        Back
      </button>
      <button
        onClick={onNext}
        disabled={nextDisabled}
        className="flex-1 bg-blue-600 text-white rounded-xl py-2.5 text-sm font-medium hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        {nextLabel}
      </button>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

const TOTAL_STEPS = 7

export default function OnboardingPage() {
  const [step, setStep] = useState(1)
  const [data, setData] = useState<OnboardingData>(DEFAULTS)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  function update(partial: Partial<OnboardingData>) {
    setData(d => ({ ...d, ...partial }))
  }

  function next() { setStep(s => Math.min(s + 1, TOTAL_STEPS)) }
  function back() { setStep(s => Math.max(s - 1, 1)) }

  async function finish() {
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/auth/login'); return }

    // Save profile
    await supabase.from('users').upsert({
      id: user.id,
      name: data.name,
      business_name: data.business_name,
      ig_handle: data.ig_handle,
      timezone: data.timezone,
      base_currency: data.base_currency,
      onboarding_complete: true,
    })

    // Save secondary currencies
    if (data.secondary_currencies.length > 0) {
      await supabase.from('secondary_currencies').insert(
        data.secondary_currencies.map(sc => ({
          user_id: user.id,
          currency_code: sc.currency_code,
          label: sc.label,
          estimated_monthly: sc.estimated_monthly,
        }))
      )
    }

    // Save KPI targets
    await supabase.from('kpi_targets').upsert({
      user_id: user.id,
      cash_target: Number(data.cash_target) || null,
      revenue_target: Number(data.cash_target) || null,
      clients_target: Number(data.clients_target) || null,
      meetings_target: Number(data.meetings_target) || null,
      followers_target: Number(data.followers_target) || null,
      close_rate_target: Number(data.close_rate_target) || null,
      show_up_target: Number(data.show_up_target) || null,
    })

    // Save setter (self or team)
    if (data.team_mode === 'solo') {
      await supabase.from('setters').insert({
        user_id: user.id,
        name: data.name || 'Me',
        role: 'both',
        is_self: true,
      })
    } else {
      for (const s of data.setters.filter(s => s.name)) {
        await supabase.from('setters').insert({
          user_id: user.id,
          name: s.name,
          role: s.role,
          is_self: false,
        })
      }
    }

    router.push('/dashboard')
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-400 font-medium">Step {step} of {TOTAL_STEPS}</span>
            <span className="text-xs text-gray-400">{Math.round((step / TOTAL_STEPS) * 100)}%</span>
          </div>
          <ProgressBar step={step} total={TOTAL_STEPS} />
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          {step === 1 && <Step1 onNext={next} />}
          {step === 2 && <Step2 data={data} onChange={update} onNext={next} onBack={back} />}
          {step === 3 && <Step3 data={data} onChange={update} onNext={next} onBack={back} />}
          {step === 4 && <Step4 data={data} onChange={update} onNext={next} onBack={back} />}
          {step === 5 && <Step5 data={data} onChange={update} onNext={next} onBack={back} />}
          {step === 6 && <Step6 data={data} onChange={update} onNext={next} onBack={back} />}
          {step === 7 && <Step7 data={data} onFinish={finish} loading={loading} />}
        </div>
      </div>
    </div>
  )
}
