'use client'

import { useState, useRef } from 'react'
import type { Ad } from '@/types'

// ─── Types ────────────────────────────────────────────────────────────────────

interface DailyLead {
  created_at: string
  followed_at: string | null
  ad_id: string | null
}

interface Props {
  ads: Ad[]
  allYearLeads: DailyLead[]
  baseCurrency: string
  currentMonth: string
  avgSalesCycleDays: number | null
}

type ChartType   = 'bar' | 'line'
type ChartPeriod = 'daily' | 'weekly' | 'monthly' | 'ytd'

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

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

function leadDate(lead: DailyLead): string {
  return lead.followed_at ?? lead.created_at.slice(0, 10)
}

function isoWeek(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00')
  const jan4 = new Date(d.getFullYear(), 0, 4)
  const weekNum = Math.ceil(((d.getTime() - jan4.getTime()) / 86_400_000 + jan4.getDay() + 1) / 7)
  return `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`
}

function fmtDate(d: string) {
  return new Date(d + 'T12:00:00').toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })
}

function fmtBucketLabel(key: string, period: ChartPeriod): string {
  if (period === 'daily') {
    const d = new Date(key + 'T12:00:00')
    return `${d.toLocaleDateString('en', { month: 'short', day: 'numeric' })}`
  }
  if (period === 'weekly') return key.replace('-W', ' W')
  if (period === 'monthly' || period === 'ytd') {
    const [y, m] = key.split('-')
    return new Date(Number(y), Number(m) - 1).toLocaleDateString('en', { month: 'short', year: '2-digit' })
  }
  return key
}

// ─── Chart ────────────────────────────────────────────────────────────────────

function FollowersChart({
  allYearLeads,
  ads,
  currentMonth,
  chartType,
  period,
}: {
  allYearLeads: DailyLead[]
  ads: Ad[]
  currentMonth: string
  chartType: ChartType
  period: ChartPeriod
}) {
  const [hovered, setHovered] = useState<{ label: string; count: number; adName: string | null } | null>(null)

  const year = Number(currentMonth.slice(0, 4))
  const today = todayStr()

  // Filter leads to relevant date range
  const filtered = allYearLeads.filter(l => {
    const d = leadDate(l)
    if (period === 'daily') return d.slice(0, 7) === currentMonth
    if (period === 'weekly') return d.slice(0, 7) === currentMonth
    return d.startsWith(String(year))
  })

  // Group into buckets
  const buckets = new Map<string, { count: number; adId: string | null }>()

  for (const lead of filtered) {
    const d = leadDate(lead)
    let key: string
    if (period === 'daily' || period === 'weekly') key = period === 'daily' ? d : isoWeek(d)
    else key = d.slice(0, 7)

    const existing = buckets.get(key)
    if (existing) {
      existing.count++
    } else {
      buckets.set(key, { count: 1, adId: lead.ad_id })
    }
  }

  // Build sorted keys
  let keys: string[]
  if (period === 'daily') {
    const [y, m] = currentMonth.split('-').map(Number)
    const daysInMonth = new Date(y, m, 0).getDate()
    const maxDay = currentMonth === today.slice(0, 7) ? new Date().getDate() : daysInMonth
    keys = Array.from({ length: maxDay }, (_, i) => `${currentMonth}-${String(i + 1).padStart(2, '0')}`)
  } else {
    keys = [...new Set([...buckets.keys()])].sort()
    if (period === 'ytd' || period === 'monthly') {
      // Ensure all months from Jan to current month exist
      for (let m = 1; m <= Number(currentMonth.slice(5, 7)); m++) {
        const k = `${year}-${String(m).padStart(2, '0')}`
        if (!buckets.has(k)) buckets.set(k, { count: 0, adId: null })
      }
      keys = [...buckets.keys()].filter(k => k.startsWith(String(year))).sort()
    }
  }

  const counts = keys.map(k => buckets.get(k)?.count ?? 0)
  const maxCount = Math.max(...counts, 1)

  // Ad color map (stable)
  const sortedAds = [...ads].sort((a, b) => a.started_at.localeCompare(b.started_at))
  const adColor = new Map(sortedAds.map((ad, i) => [ad.id, AD_COLORS[i % AD_COLORS.length]]))

  function colorForBucket(key: string, adId: string | null): string {
    if (adId && adColor.has(adId)) return adColor.get(adId)!
    // Determine by date range
    const dateStr = period === 'daily' ? key : key + '-15'
    for (const ad of ads) {
      if (ad.started_at <= dateStr && (ad.ended_at === null || ad.ended_at >= dateStr)) {
        return adColor.get(ad.id) ?? 'var(--border-strong)'
      }
    }
    return 'var(--border-strong)'
  }

  const HEIGHT = 72
  const pts = keys.map((k, i) => {
    const c = counts[i]
    const x = (i / Math.max(keys.length - 1, 1)) * 100
    const y = c > 0 ? (1 - c / maxCount) * HEIGHT : HEIGHT
    return { x, y, count: c, key: k, adId: buckets.get(k)?.adId ?? null }
  })

  return (
    <div style={{ marginTop: 16 }}>
      {hovered ? (
        <p style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 6, height: 16 }}>
          {hovered.label}: {hovered.count} follower{hovered.count !== 1 ? 's' : ''}{hovered.adName ? ` · ${hovered.adName}` : ''}
        </p>
      ) : (
        <div style={{ height: 16, marginBottom: 6 }} />
      )}

      {chartType === 'bar' ? (
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: period === 'daily' ? 2 : 4, height: HEIGHT }}>
          {keys.map((key, i) => {
            const count = counts[i]
            const color = colorForBucket(key, buckets.get(key)?.adId ?? null)
            const heightPct = count > 0 ? Math.max((count / maxCount) * 100, 6) : 3
            return (
              <div
                key={key}
                style={{ flex: 1, display: 'flex', alignItems: 'flex-end', height: '100%', cursor: count > 0 ? 'pointer' : 'default' }}
                onMouseEnter={() => setHovered({ label: fmtBucketLabel(key, period), count, adName: buckets.get(key)?.adId ? (ads.find(a => a.id === buckets.get(key)?.adId)?.name ?? null) : null })}
                onMouseLeave={() => setHovered(null)}
              >
                <div style={{
                  width: '100%', height: `${heightPct}%`,
                  background: count > 0 ? color : 'var(--border)',
                  borderRadius: 2, opacity: count > 0 ? 1 : 0.3,
                  transition: 'opacity 100ms',
                }} />
              </div>
            )
          })}
        </div>
      ) : (
        // Line / wave chart
        <svg viewBox={`0 0 100 ${HEIGHT}`} preserveAspectRatio="none" style={{ width: '100%', height: HEIGHT, display: 'block', overflow: 'visible' }}>
          {/* Fill area */}
          <defs>
            <linearGradient id="chart-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--neon-indigo)" stopOpacity="0.18" />
              <stop offset="100%" stopColor="var(--neon-indigo)" stopOpacity="0.01" />
            </linearGradient>
          </defs>
          {pts.length > 1 && (
            <>
              <path
                d={`M ${pts[0].x} ${HEIGHT} L ${pts[0].x} ${pts[0].y} ${pts.map(p => `L ${p.x} ${p.y}`).join(' ')} L ${pts[pts.length - 1].x} ${HEIGHT} Z`}
                fill="url(#chart-fill)"
              />
              <polyline
                points={pts.map(p => `${p.x},${p.y}`).join(' ')}
                fill="none"
                stroke="var(--neon-indigo)"
                strokeWidth="1.2"
                vectorEffect="non-scaling-stroke"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              {pts.map((p, i) => p.count > 0 && (
                <circle
                  key={i}
                  cx={p.x} cy={p.y} r="2"
                  fill={colorForBucket(p.key, p.adId)}
                  vectorEffect="non-scaling-stroke"
                  style={{ cursor: 'pointer' }}
                  onMouseEnter={() => setHovered({ label: fmtBucketLabel(p.key, period), count: p.count, adName: p.adId ? (ads.find(a => a.id === p.adId)?.name ?? null) : null })}
                  onMouseLeave={() => setHovered(null)}
                />
              ))}
            </>
          )}
        </svg>
      )}

      {/* Legend */}
      {sortedAds.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 10px', marginTop: 8 }}>
          {sortedAds.map(ad => (
            <div key={ad.id} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 8, height: 8, borderRadius: 2, background: adColor.get(ad.id) ?? 'var(--border-strong)', flexShrink: 0 }} />
              <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{ad.name}{ad.ended_at === null ? ' ●' : ''}</span>
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
          style={{ width: 80, fontSize: 13, fontWeight: 600, background: 'var(--surface-2)', border: '1px solid var(--accent)', borderRadius: 4, padding: '2px 6px', color: 'var(--text-1)', outline: 'none' }}
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
      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 13, fontWeight: 600, color: 'var(--text-1)', textDecoration: 'underline dotted var(--border-strong)', textUnderlineOffset: 3 }}
    >
      {prefix}{value.toLocaleString()}
    </button>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AdsSection({ ads: initialAds, allYearLeads, baseCurrency, currentMonth, avgSalesCycleDays }: Props) {
  const [ads, setAds] = useState<Ad[]>(initialAds)
  const [showNewForm, setShowNewForm] = useState(false)
  const [formName, setFormName] = useState('')
  const [formPlatform, setFormPlatform] = useState('Instagram')
  const [formStarted, setFormStarted] = useState(todayStr())
  const [formEnded, setFormEnded] = useState('')
  const [formBudget, setFormBudget] = useState('')
  const [formTotalSpend, setFormTotalSpend] = useState('')
  const [creating, setCreating] = useState(false)
  const [chartType, setChartType] = useState<ChartType>('bar')
  const [chartPeriod, setChartPeriod] = useState<ChartPeriod>('daily')

  const activeAd = ads.find(a => a.ended_at === null)
  const pastAds = ads.filter(a => a.ended_at !== null)
  const isPastAd = formEnded !== ''

  function followersForAd(adId: string) {
    return allYearLeads.filter(l => l.ad_id === adId).length
  }

  function cpf(ad: Ad) {
    const f = followersForAd(ad.id)
    if (f === 0 || ad.total_spend === 0) return null
    return ad.total_spend / f
  }

  function activeDays(ad: Ad) {
    const end = ad.ended_at ?? todayStr()
    return Math.max(Math.floor((new Date(end + 'T12:00:00').getTime() - new Date(ad.started_at + 'T12:00:00').getTime()) / 86_400_000) + 1, 1)
  }

  async function handleCreate() {
    const budget = parseFloat(formBudget)
    const totalSpend = formTotalSpend ? parseFloat(formTotalSpend) : 0
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
          ended_at: formEnded || null,
          daily_budget: budget,
          total_spend: totalSpend,
          currency: baseCurrency,
        }),
      })
      if (res.ok) {
        const json = await res.json() as { ad: Ad }
        setAds(prev => {
          // If new ad has no end date, close any previously active one
          const updated = json.ad.ended_at === null
            ? prev.map(a => a.ended_at === null ? { ...a, ended_at: formStarted } : a)
            : prev
          return [json.ad, ...updated]
        })
        setShowNewForm(false)
        setFormName('')
        setFormBudget('')
        setFormTotalSpend('')
        setFormStarted(todayStr())
        setFormEnded('')
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

  const periodLabels: { key: ChartPeriod; label: string }[] = [
    { key: 'daily', label: 'Day' },
    { key: 'weekly', label: 'Week' },
    { key: 'monthly', label: 'Month' },
    { key: 'ytd', label: 'YTD' },
  ]

  return (
    <div style={{ background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: 'var(--radius-card)', padding: '20px 18px', boxShadow: 'var(--shadow-card)' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
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
              <input type="text" value={formName} onChange={e => setFormName(e.target.value)} placeholder="e.g. Summer hook v3" className="input-base" autoFocus />
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
              <input type="date" value={formStarted} onChange={e => setFormStarted(e.target.value)} className="input-base" max={todayStr()} />
            </div>
            <div>
              <label className="label-caps" style={{ display: 'block', marginBottom: 4 }}>Ended on <span style={{ color: 'var(--text-3)', textTransform: 'none', fontWeight: 400 }}>(blank = running)</span></label>
              <input type="date" value={formEnded} onChange={e => setFormEnded(e.target.value)} className="input-base" min={formStarted} max={todayStr()} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-caps" style={{ display: 'block', marginBottom: 4 }}>Daily budget ({baseCurrency})</label>
              <input type="number" value={formBudget} onChange={e => setFormBudget(e.target.value)} placeholder="50" min="0" className="input-base" />
            </div>
            {isPastAd && (
              <div>
                <label className="label-caps" style={{ display: 'block', marginBottom: 4 }}>Total spent ({baseCurrency})</label>
                <input type="number" value={formTotalSpend} onChange={e => setFormTotalSpend(e.target.value)} placeholder="0" min="0" className="input-base" />
              </div>
            )}
          </div>
          <div>
            <button onClick={handleCreate} disabled={creating || !formName.trim() || !formBudget} className="btn-primary" style={{ padding: '8px 16px' }}>
              {creating ? 'Saving…' : isPastAd ? 'Add past ad' : 'Activate ad'}
            </button>
            {!isPastAd && activeAd && (
              <span style={{ fontSize: 12, color: 'var(--text-3)', marginLeft: 10 }}>Will end "{activeAd.name}" as of {formStarted}</span>
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

      {/* Active ad card */}
      {activeAd && (
        <div style={{ marginBottom: 16, padding: 14, borderRadius: 'var(--radius-card)', background: 'var(--bg-glass)', border: '1px solid var(--border-glow)', boxShadow: 'var(--glow-indigo)' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: 'var(--success)', boxShadow: '0 0 6px var(--success)' }} />
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-1)' }}>{activeAd.name}</span>
                {activeAd.platform && (
                  <span style={{ fontSize: 11, color: 'var(--text-3)', padding: '1px 6px', borderRadius: 10, background: 'var(--surface-2)', border: '1px solid var(--border)' }}>{activeAd.platform}</span>
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
              <InlineEdit value={activeAd.daily_budget} prefix={baseCurrency + ' '} onSave={v => updateAd(activeAd.id, { daily_budget: v })} />
            </div>
            <div>
              <p style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-3)', margin: '0 0 2px' }}>Total spent</p>
              <InlineEdit value={activeAd.total_spend} prefix={baseCurrency + ' '} onSave={v => updateAd(activeAd.id, { total_spend: v })} />
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

      {/* Followers chart + controls */}
      {(allYearLeads.length > 0 || ads.length > 0) && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-3)', margin: 0 }}>
              Followers
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {/* Chart type toggle */}
              <div style={{ display: 'flex', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden' }}>
                {(['bar', 'line'] as ChartType[]).map(t => (
                  <button
                    key={t}
                    onClick={() => setChartType(t)}
                    style={{
                      padding: '3px 8px', fontSize: 11, border: 'none', cursor: 'pointer',
                      background: chartType === t ? 'var(--accent)' : 'transparent',
                      color: chartType === t ? '#fff' : 'var(--text-3)',
                      fontWeight: chartType === t ? 600 : 400,
                    }}
                  >
                    {t === 'bar' ? '▋' : '〜'}
                  </button>
                ))}
              </div>
              {/* Period toggle */}
              <div style={{ display: 'flex', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden' }}>
                {periodLabels.map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => setChartPeriod(key)}
                    style={{
                      padding: '3px 8px', fontSize: 11, border: 'none', cursor: 'pointer',
                      background: chartPeriod === key ? 'var(--accent)' : 'transparent',
                      color: chartPeriod === key ? '#fff' : 'var(--text-3)',
                      fontWeight: chartPeriod === key ? 600 : 400,
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <FollowersChart
            allYearLeads={allYearLeads}
            ads={ads}
            currentMonth={currentMonth}
            chartType={chartType}
            period={chartPeriod}
          />
        </div>
      )}

      {/* Past ads table */}
      {pastAds.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-3)', marginBottom: 8 }}>Past ads</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
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
                    <InlineEdit value={ad.total_spend} prefix={baseCurrency + ' '} onSave={v => updateAd(ad.id, { total_spend: v })} />
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
