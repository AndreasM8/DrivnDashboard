'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { CURRENCIES, TIMEZONES } from '@/types'
import { getLiveRate } from '@/lib/exchange-rates-client'
import type { Language } from '@/types'

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
  secondary_currencies: [],
  team_mode: 'solo', setters: [],
  cash_target: '75000', clients_target: '5', meetings_target: '25',
  followers_target: '200', close_rate_target: '25', show_up_target: '60',
  uses_manychat: false, uses_zapier: false, uses_stripe: false,
}

// ─── Step 0: Language ─────────────────────────────────────────────────────────

function Step0Language({ onNext }: { onNext: (lang: Language) => void }) {
  const [saving, setSaving] = useState(false)

  async function choose(lang: Language) {
    setSaving(true)
    await fetch('/api/settings/language', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ language: lang }),
    }).catch(() => {})
    setSaving(false)
    onNext(lang)
  }

  return (
    <div className="text-center">
      <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
        <span className="text-white text-2xl font-bold">D</span>
      </div>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100 mb-3">Choose your language</h1>
      <p className="text-gray-500 dark:text-slate-400 mb-10">You can change this at any time in settings.</p>
      <div className="flex flex-col gap-4">
        <button
          onClick={() => choose('en')}
          disabled={saving}
          className="w-full flex items-center justify-center gap-3 py-4 rounded-xl border-2 border-gray-200 dark:border-slate-600 text-lg font-semibold text-gray-800 dark:text-slate-100 hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all disabled:opacity-50"
        >
          <span className="text-2xl">🇬🇧</span> English
        </button>
        <button
          onClick={() => choose('no')}
          disabled={saving}
          className="w-full flex items-center justify-center gap-3 py-4 rounded-xl border-2 border-gray-200 dark:border-slate-600 text-lg font-semibold text-gray-800 dark:text-slate-100 hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all disabled:opacity-50"
        >
          <span className="text-2xl">🇳🇴</span> Norsk
        </button>
      </div>
    </div>
  )
}

// ─── Progress bar ─────────────────────────────────────────────────────────────

function ProgressBar({ step, total }: { step: number; total: number }) {
  return (
    <div className="w-full h-1 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
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
      <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100 mb-3">Your business, finally in one place</h1>
      <p className="text-gray-500 dark:text-slate-400 mb-8">Drivn replaces your Google Sheets, sticky notes, and scattered DMs with one simple system.</p>

      <div className="space-y-3 text-left mb-10">
        {[
          { icon: '📊', title: 'Pipeline', desc: 'Track every lead from follower to signed client' },
          { icon: '✅', title: 'Tasks', desc: 'Know exactly what to do every single day' },
          { icon: '💰', title: 'Numbers', desc: 'See your revenue, close rate, and KPIs at a glance' },
        ].map(f => (
          <div key={f.title} className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-slate-700/50 rounded-xl">
            <span className="text-xl">{f.icon}</span>
            <div>
              <p className="font-medium text-gray-900 dark:text-slate-100 text-sm">{f.title}</p>
              <p className="text-xs text-gray-500 dark:text-slate-400">{f.desc}</p>
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
      <h2 className="text-xl font-bold text-gray-900 dark:text-slate-100 mb-1">Tell us about you</h2>
      <p className="text-gray-500 dark:text-slate-400 text-sm mb-6">This appears in your dashboard and reports.</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        <Field label="Your name" value={data.name} onChange={v => onChange({ name: v })} placeholder="Alex" />
        <Field label="Business name" value={data.business_name} onChange={v => onChange({ business_name: v })} placeholder="Alex Coaching" />
        <Field label="Instagram handle" value={data.ig_handle} onChange={v => onChange({ ig_handle: v })} placeholder="@alexcoach" />
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Timezone</label>
          <select
            value={data.timezone}
            onChange={e => onChange({ timezone: e.target.value })}
            className="w-full px-3 py-2.5 border border-gray-200 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
      <h2 className="text-xl font-bold text-gray-900 dark:text-slate-100 mb-1">Currency & region</h2>
      <p className="text-gray-500 dark:text-slate-400 text-sm mb-6">All revenue will be shown in your base currency.</p>

      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">Base currency</label>
        <div className="grid grid-cols-4 gap-2">
          {CURRENCIES.map(c => (
            <button
              key={c.code}
              onClick={() => onChange({ base_currency: c.code })}
              className={`flex flex-col items-center p-2.5 rounded-xl border-2 text-sm font-medium transition-all ${
                data.base_currency === c.code
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                  : 'border-gray-100 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-700 dark:text-slate-300 hover:border-gray-200 dark:hover:border-slate-500'
              }`}
            >
              <span className="text-lg mb-0.5">{c.flag}</span>
              <span>{c.code}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
          Secondary currencies <span className="text-gray-400 dark:text-slate-500 font-normal">(optional — e.g. if you spend on Meta ads in AED)</span>
        </label>

        {data.secondary_currencies.map(sc => (
          <div key={sc.currency_code} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-slate-700/50 rounded-xl mb-2">
            <span className="text-lg">{CURRENCIES.find(c => c.code === sc.currency_code)?.flag ?? '💱'}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 dark:text-slate-100">{sc.currency_code} — {sc.label}</p>
              {sc.rate && (
                <p className="text-xs text-gray-400 dark:text-slate-500">1 {sc.currency_code} ≈ {sc.rate.toFixed(2)} {data.base_currency}</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={sc.estimated_monthly || ''}
                onChange={e => updateEstimate(sc.currency_code, Number(e.target.value))}
                placeholder="Monthly spend"
                className="w-28 px-2 py-1.5 border border-gray-200 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-lg text-xs text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
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
            className="px-3 py-2 border border-gray-200 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {CURRENCIES.filter(c => c.code !== data.base_currency).map(c => (
              <option key={c.code} value={c.code}>{c.flag} {c.code}</option>
            ))}
          </select>
          <input
            value={addLabel}
            onChange={e => setAddLabel(e.target.value)}
            placeholder="Label (e.g. Meta ads)"
            className="flex-1 px-3 py-2 border border-gray-200 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-400 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={addCurrency}
            className="px-4 py-2 bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-300 rounded-lg text-sm font-medium hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors"
          >
            Add
          </button>
        </div>
      </div>

      <StepNav onBack={onBack} onNext={onNext} />
    </div>
  )
}

// ─── Step 4 (shown as step 4): Cash Target ────────────────────────────────────

function Step5({ data, onChange, onNext, onBack }: StepProps) {
  const currency = data.base_currency

  return (
    <div>
      <h2 className="text-xl font-bold text-gray-900 dark:text-slate-100 mb-1">What&apos;s your monthly cash goal?</h2>
      <p className="text-gray-500 dark:text-slate-400 text-sm mb-6">This is how much cash you want to collect each month. You can change it anytime in Settings.</p>

      <div className="mb-8">
        <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">Monthly cash target ({currency})</label>
        <input
          type="number"
          value={data.cash_target}
          onChange={e => onChange({ cash_target: e.target.value })}
          placeholder="e.g. 75000"
          className="w-full px-4 py-3 border border-gray-200 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-xl text-lg font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <p className="text-xs text-gray-400 dark:text-slate-500 mt-2">This shows up as your target on the dashboard so you always know where you stand.</p>
      </div>

      <StepNav onBack={onBack} onNext={onNext} />
      <button onClick={onNext} className="w-full text-center text-sm text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-400 mt-3 transition-colors">
        Skip — I&apos;ll set this later
      </button>
    </div>
  )
}

// ─── Step 5: Done ─────────────────────────────────────────────────────────────

function Step6Done({ data, onFinish, loading }: { data: OnboardingData; onFinish: () => void; loading: boolean }) {
  return (
    <div className="text-center">
      <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5">
        <svg className="w-10 h-10 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <h2 className="text-2xl font-bold text-gray-900 dark:text-slate-100 mb-2">You&apos;re all set!</h2>
      <p className="text-gray-500 dark:text-slate-400 mb-8">Your dashboard is ready. You can connect tools like Stripe or Calendly later in Settings — no rush.</p>

      <div className="bg-gray-50 dark:bg-slate-700/50 rounded-xl p-4 mb-8 text-left space-y-3">
        <div className="flex items-center gap-3">
          <span className="w-5 h-5 rounded-full bg-green-100 text-green-600 flex items-center justify-center flex-shrink-0">
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
          </span>
          <span className="text-sm text-gray-700 dark:text-slate-300">Profile: <strong>{data.name || 'set up'}</strong></span>
        </div>
        <div className="flex items-center gap-3">
          <span className="w-5 h-5 rounded-full bg-green-100 text-green-600 flex items-center justify-center flex-shrink-0">
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
          </span>
          <span className="text-sm text-gray-700 dark:text-slate-300">Currency: <strong>{data.base_currency}</strong></span>
        </div>
        {data.cash_target && (
          <div className="flex items-center gap-3">
            <span className="w-5 h-5 rounded-full bg-green-100 text-green-600 flex items-center justify-center flex-shrink-0">
              <svg viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
            </span>
            <span className="text-sm text-gray-700 dark:text-slate-300">Monthly target: <strong>{data.cash_target} {data.base_currency}</strong></span>
          </div>
        )}
      </div>

      <button
        onClick={onFinish}
        disabled={loading}
        className="w-full bg-blue-600 text-white rounded-xl py-3 font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors text-base"
      >
        {loading ? 'Setting up…' : "You're all set! Go to your dashboard →"}
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
      <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">{label}</label>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2.5 border border-gray-200 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-400 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
        className="px-5 py-2.5 border border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-400 rounded-xl text-sm font-medium hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
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

// Steps: 0=Language, 1=Welcome, 2=Profile, 3=Currency, 4=Cash target, 5=Done
const TOTAL_STEPS = 5

export default function OnboardingPage() {
  const [step, setStep] = useState(0)
  const [data, setData] = useState<OnboardingData>(DEFAULTS)
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(true)
  const router = useRouter()

  // Re-entry guard: redirect to /dashboard if onboarding already completed
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { setChecking(false); return }
      const { data: profile } = await supabase
        .from('users')
        .select('onboarding_complete, name')
        .eq('id', user.id)
        .single()
      if (profile?.onboarding_complete) {
        router.replace('/dashboard')
      } else {
        setChecking(false)
      }
    })
  }, [router])

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

  if (checking) return null

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 flex flex-col items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        {step > 0 && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-400 dark:text-slate-500 font-medium">Step {step} of {TOTAL_STEPS}</span>
              <span className="text-xs text-gray-400 dark:text-slate-500">{Math.round((step / TOTAL_STEPS) * 100)}%</span>
            </div>
            <ProgressBar step={step} total={TOTAL_STEPS} />
          </div>
        )}

        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 p-8">
          {step === 0 && <Step0Language onNext={() => next()} />}
          {step === 1 && <Step1 onNext={next} />}
          {step === 2 && <Step2 data={data} onChange={update} onNext={next} onBack={back} />}
          {step === 3 && <Step3 data={data} onChange={update} onNext={next} onBack={back} />}
          {step === 4 && <Step5 data={data} onChange={update} onNext={next} onBack={back} />}
          {step === 5 && <Step6Done data={data} onFinish={finish} loading={loading} />}
        </div>
      </div>
    </div>
  )
}
