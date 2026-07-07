'use client'

import { useState, useRef } from 'react'
import type { Ad } from '@/types'

// ─── Types ────────────────────────────────────────────────────────────────────

interface DailyLead {
  created_at: string
  ad_id: string | null
}

interface Props {
  ads: Ad[]
  dailyLeads: DailyLead[]
  baseCurrency: string
  currentMonth: string
  avgSalesCycleDays: number | null
}

const PLATFORMS = ['Instagram', 'Facebook', 'TikTok', 'YouTube', 'Other']

const AD_COLORS = [
  'var(--neon-indigo)',
  'var(--neon-cyan)',
  '#f59e0b',
  '#10b981',
  '#f43f5e',
  '#a78bfa',
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number, currency: string) {
  return new Intl.NumberFormat('en', { style: 'currency', currency, maximumFractionDigits: 0 }).format(n)
}

function daysBetween(a: string, b: string) {
  return Math.floor((new Date(b).getTime() - new Date(a).getTime()) / 86_400_000)
}

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

// ─── Followers-per-day bar chart ──────────────────────────────────────────────

function FollowersChart({ dailyLeads, ads, currentMonth }: { dailyLeads: DailyLead[]; ads: Ad[]; currentMonth: string }) {
  const [hovered, setHovered] = useState<{ day: number; count: number; adName: string | null } | null>(null)

  const [year, month] = currentMonth.split('-').map(Number)
  const daysInMonth = new Date(year, month, 0).getDate()

  // Build a color map: adId -> color index (stable order by started_at asc)
  const sortedAds = [...ads].sort((a, b) => a.started_at.localeCompare(b.started_at))
  const adColor = new Map(sortedAds.map((ad, i) => [ad.id, AD_COLORS[i % AD_COLORS.length]]))

  // Count followers per day
  const countsByDay: Record<number, { count: number; adId: string | null }> = {}
  for (const lead of dailyLeads) {
    const d = new Date(lead.created_at)
    if (d.getFullYear() === year && d.getMonth() + 1 === month) {
      const day = d.getDate()
      if (!countsByDay[day]) countsByDay[day] = { count: 0, adId: lead.ad_id }
      countsByDay[day].count++
    }
  }

  const maxCount = Math.max(...Object.values(countsByDay).map(v => v.count), 1)

  // Determine which ad was running on a given day (for days with no leads)
  function adOnDay(day: number): string | null {
    const dateStr = `${currentMonth}-${String(day).padStart(2, '0')}`
    for (const ad of ads) {
      if (ad.started_at <= dateStr && (ad.ended_at === null || ad.ended_at >= dateStr)) {
        return ad.id
      }
    }
    return null
  }

  const today = new Date().getDate()
  const showDays = currentMonth === todayStr().slice(0, 7) ? today : daysInMonth

  return (
    <div style={{ marginTop: 16 }}>
      <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-3)', marginBottom: 8 }}>
        Followers / day
      </p>
      {hovered && (
        <p style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 6, height: 16 }}>
          Day {hovered.day}: {hovered.count} follower{hovered.count !== 1 ? 's' : ''}{hovered.adName ? ` · ${hovered.adName}` : ''}
        </p>
      )}
      {!hovered && <div style={{ height: 16, marginBottom: 6 }} />}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 56 }}>
        {Array.from({ length: showDays }, (_, i) => {
          const day = i + 1
          const entry = countsByDay[day]
          const count = entry?.count ?? 0
          const adId = entry?.adId ?? adOnDay(day)
          const color = adId ? (adColor.get(adId) ?? 'var(--border-strong)') : 'var(--border)'
          const heightPct = count > 0 ? Math.max((count / maxCount) * 100, 8) : 4
          return (
            <div
              key={day}
              style={{ flex: 1, display: 'flex', alignItems: 'flex-end', height: '100%', cursor: count > 0 ? 'pointer' : 'default' }}
              onMouseEnter={() => setHovered({ day, count, adName: adId ? (ads.find(a => a.id === adId)?.name ?? null) : null })}
              onMouseLeave={() => setHovered(null)}
            >
              <div style={{
                width: '100%',
                height: `${heightPct}%`,
                background: count > 0 ? color : 'var(--border)',
                borderRadius: 2,
                opacity: count > 0 ? 1 : 0.35,
                transition: 'opacity 100ms',
              }} />
            </div>
          )
        })}
      </div>
      {/* Legend */}
      {sortedAds.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 12px', marginTop: 8 }}>
          {sortedAds.map(ad => (
            <div key={ad.id} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 8, height: 8, borderRadius: 2, background: adColor.get(ad.id) ?? 'var(--border-strong)', flexShrink: 0 }} />
              <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{ad.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Inline editable number ───────────────────────────────────────────────────

function InlineEdit({ value, onSave, prefix = '' }: { value: number; onSave: (v: number) => Promise<void>; prefix?: string }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  function startEdit() {
    setDraft(String(value))
    setEditing(true)
    setTimeout(() => inputRef.current?.select(), 0)
  }

  async function commit() {
    const n = parseFloat(draft)
    if (isNaN(n) || n < 0) { setEditing(false); return }
    setSaving(true)
    await onSave(n)
    setSaving(false)
    setEditing(false)
  }

  if (editing) {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        {prefix && <span style={{ fontSize: 13, color: 'var(--text-2)' }}>{prefix}</span>}
        <input
          ref={inputRef}
          type="number"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false) }}
          onBlur={commit}
          style={{
            width: 80, fontSize: 13, fontWeight: 600,
            background: 'var(--surface-2)', border: '1px solid var(--accent)',
            borderRadius: 4, padding: '2px 6px', color: 'var(--text-1)',
            outline: 'none',
          }}
          disabled={saving}
          autoFocus
        />
      </span>
    )
  }

  return (
    <button
      onClick={startEdit}
      title="Click to edit"
      style={{
        background: 'none', border: 'none', cursor: 'pointer', padding: 0,
        fontSize: 13, fontWeight: 600, color: 'var(--text-1)',
        textDecoration: 'underline dotted var(--border-strong)',
        textUnderlineOffset: 3,
      }}
    >
      {prefix}{value.toLocaleString()}
    </button>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AdsSection({ ads: initialAds, dailyLeads, baseCurrency, currentMonth, avgSalesCycleDays }: Props) {
  const [ads, setAds] = useState<Ad[]>(initialAds)
  const [showNewForm, setShowNewForm] = useState(false)
  const [formName, setFormName] = useState('')
  const [formPlatform, setFormPlatform] = useState('Instagram')
  const [formStarted, setFormStarted] = useState(todayStr())
  const [formBudget, setFormBudget] = useState('')
  const [creating, setCreating] = useState(false)

  const activeAd = ads.find(a => a.ended_at === null)
  const pastAds = ads.filter(a => a.ended_at !== null)

  // Followers attributed to each ad
  function followersForAd(adId: string) {
    return dailyLeads.filter(l => l.ad_id === adId).length
  }

  function cpf(ad: Ad) {
    const f = followersForAd(ad.id)
    if (f === 0 || ad.total_spend === 0) return null
    return ad.total_spend / f
  }

  function activeDays(ad: Ad) {
    const end = ad.ended_at ?? todayStr()
    return Math.max(daysBetween(ad.started_at, end) + 1, 1)
  }

  async function handleCreate() {
    const budget = parseFloat(formBudget)
    if (!formName.trim() || isNaN(budget) || budget <= 0) return
    setCreating(true)
    try {
      const res = await fetch('/api/ads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formName.trim(),
          platform: formPlatform,
          started_at: formStarted,
          daily_budget: budget,
          currency: baseCurrency,
        }),
      })
      if (res.ok) {
        const json = await res.json() as { ad: Ad }
        // End previous active ad locally
        setAds(prev => [
          json.ad,
          ...prev.map(a => a.ended_at === null ? { ...a, ended_at: formStarted } : a),
        ])
        setShowNewForm(false)
        setFormName('')
        setFormBudget('')
        setFormStarted(todayStr())
      }
    } finally {
      setCreating(false)
    }
  }

  async function updateAd(id: string, patch: Partial<Ad>) {
    const res = await fetch(`/api/ads/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    if (res.ok) {
      setAds(prev => prev.map(a => a.id === id ? { ...a, ...patch } : a))
    }
  }

  function fmtDate(d: string) {
    return new Date(d + 'T12:00:00').toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  return (
    <div style={{ background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: 'var(--radius-card)', padding: '20px 18px', boxShadow: 'var(--shadow-card)' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--text-1)' }}>Ads</h3>
          {avgSalesCycleDays !== null && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '3px 8px', borderRadius: 20, background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
              <span style={{ fontSize: 11, color: 'var(--text-3)' }}>Avg sales cycle</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--neon-cyan)', fontFamily: 'var(--font-mono)' }}>
                {Math.round(avgSalesCycleDays)}d
              </span>
            </div>
          )}
        </div>
        <button
          onClick={() => setShowNewForm(v => !v)}
          style={{ fontSize: 12, fontWeight: 500, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px', borderRadius: 'var(--radius-btn)' }}
        >
          {showNewForm ? 'Cancel' : '+ New ad'}
        </button>
      </div>

      {/* New ad form */}
      {showNewForm && (
        <div style={{ marginBottom: 16, padding: 14, borderRadius: 'var(--radius-card)', background: 'var(--surface-2)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-caps" style={{ display: 'block', marginBottom: 4 }}>Ad name</label>
              <input
                type="text"
                value={formName}
                onChange={e => setFormName(e.target.value)}
                placeholder="e.g. Summer hook v3"
                className="input-base"
                autoFocus
              />
            </div>
            <div>
              <label className="label-caps" style={{ display: 'block', marginBottom: 4 }}>Platform</label>
              <select value={formPlatform} onChange={e => setFormPlatform(e.target.value)} className="input-base">
                {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-caps" style={{ display: 'block', marginBottom: 4 }}>Started on</label>
              <input
                type="date"
                value={formStarted}
                onChange={e => setFormStarted(e.target.value)}
                className="input-base"
              />
            </div>
            <div>
              <label className="label-caps" style={{ display: 'block', marginBottom: 4 }}>Daily budget ({baseCurrency})</label>
              <input
                type="number"
                value={formBudget}
                onChange={e => setFormBudget(e.target.value)}
                placeholder="50"
                min="0"
                className="input-base"
              />
            </div>
          </div>
          <div>
            <button
              onClick={handleCreate}
              disabled={creating || !formName.trim() || !formBudget}
              className="btn-primary"
              style={{ padding: '8px 16px' }}
            >
              {creating ? 'Activating…' : 'Activate ad'}
            </button>
            {activeAd && (
              <span style={{ fontSize: 12, color: 'var(--text-3)', marginLeft: 10 }}>
                Will end "{activeAd.name}" as of {formStarted}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Empty state */}
      {ads.length === 0 && !showNewForm && (
        <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-3)' }}>
          <p style={{ fontSize: 13 }}>No ads tracked yet. Hit + New ad to start.</p>
        </div>
      )}

      {/* Active ad */}
      {activeAd && (
        <div style={{ marginBottom: 16, padding: 14, borderRadius: 'var(--radius-card)', background: 'var(--bg-glass)', border: '1px solid var(--border-glow)', boxShadow: 'var(--glow-indigo)' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: 'var(--success)', boxShadow: '0 0 6px var(--success)' }} />
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-1)' }}>{activeAd.name}</span>
                {activeAd.platform && (
                  <span style={{ fontSize: 11, color: 'var(--text-3)', padding: '1px 6px', borderRadius: 10, background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
                    {activeAd.platform}
                  </span>
                )}
              </div>
              <p style={{ fontSize: 12, color: 'var(--text-3)', margin: '3px 0 0' }}>
                Running since {fmtDate(activeAd.started_at)} · Day {activeDays(activeAd)}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4" style={{ gap: 12 }}>
            <div>
              <p style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-3)', margin: '0 0 2px' }}>Daily budget</p>
              <InlineEdit
                value={activeAd.daily_budget}
                prefix={baseCurrency + ' '}
                onSave={v => updateAd(activeAd.id, { daily_budget: v })}
              />
            </div>
            <div>
              <p style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-3)', margin: '0 0 2px' }}>Total spent</p>
              <InlineEdit
                value={activeAd.total_spend}
                prefix={baseCurrency + ' '}
                onSave={v => updateAd(activeAd.id, { total_spend: v })}
              />
            </div>
            <div>
              <p style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-3)', margin: '0 0 2px' }}>Followers</p>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)' }}>{followersForAd(activeAd.id)}</span>
            </div>
            <div>
              <p style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-3)', margin: '0 0 2px' }}>Cost / follow</p>
              <span style={{ fontSize: 13, fontWeight: 600, color: cpf(activeAd) ? 'var(--text-1)' : 'var(--text-3)' }}>
                {cpf(activeAd) != null ? fmt(cpf(activeAd)!, baseCurrency) : '—'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Followers per day chart */}
      {dailyLeads.length > 0 || ads.length > 0 ? (
        <FollowersChart dailyLeads={dailyLeads} ads={ads} currentMonth={currentMonth} />
      ) : null}

      {/* Past ads table */}
      {pastAds.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-3)', marginBottom: 8 }}>Past ads</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {/* Header */}
            <div className="grid grid-cols-4" style={{ gap: 8, padding: '0 0 6px', borderBottom: '1px solid var(--border)' }}>
              {['Name', 'Period', 'Spent', 'CPF'].map(h => (
                <span key={h} style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-3)' }}>{h}</span>
              ))}
            </div>
            {pastAds.map(ad => {
              const f = followersForAd(ad.id)
              const c = cpf(ad)
              return (
                <div key={ad.id} className="grid grid-cols-4" style={{ gap: 8, padding: '8px 0', borderBottom: '1px solid var(--border)', alignItems: 'center' }}>
                  <div>
                    <p style={{ fontSize: 13, color: 'var(--text-1)', margin: 0, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ad.name}</p>
                    {ad.platform && <p style={{ fontSize: 11, color: 'var(--text-3)', margin: 0 }}>{ad.platform}</p>}
                  </div>
                  <div>
                    <p style={{ fontSize: 11, color: 'var(--text-2)', margin: 0 }}>{fmtDate(ad.started_at)}</p>
                    <p style={{ fontSize: 11, color: 'var(--text-3)', margin: 0 }}>→ {fmtDate(ad.ended_at!)}</p>
                  </div>
                  <div>
                    <InlineEdit
                      value={ad.total_spend}
                      prefix={baseCurrency + ' '}
                      onSave={v => updateAd(ad.id, { total_spend: v })}
                    />
                    <p style={{ fontSize: 11, color: 'var(--text-3)', margin: '1px 0 0' }}>{f} followers</p>
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 600, color: c ? 'var(--text-1)' : 'var(--text-3)' }}>
                    {c != null ? fmt(c, baseCurrency) : '—'}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
