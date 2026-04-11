'use client'

import { useState, useRef, useEffect } from 'react'
import type { WeeklyCheckin } from '@/types'
import { useT } from '@/contexts/LanguageContext'

interface Props {
  checkins: WeeklyCheckin[]
  currency: string
}

function formatWeek(weekStart: string, weekEnd: string): string {
  const s = new Date(weekStart + 'T00:00:00Z')
  const e = new Date(weekEnd + 'T00:00:00Z')
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', timeZone: 'UTC' }
  return `${s.toLocaleDateString('en', opts)} – ${e.toLocaleDateString('en', { ...opts, year: 'numeric', timeZone: 'UTC' })}`
}

function happinessColor(val: number): string {
  if (val <= 3) return '#DC2626'
  if (val <= 6) return '#D97706'
  if (val <= 8) return '#16A34A'
  return 'var(--accent)'
}

function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat('en', {
    style: 'currency', currency, maximumFractionDigits: 0,
  }).format(amount)
}

function HappinessChart({ checkins }: { checkins: WeeklyCheckin[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const last12 = [...checkins]
    .filter(c => c.happiness_rating !== null)
    .slice(0, 12)
    .reverse()

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || last12.length < 2) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const W = canvas.offsetWidth
    const H = canvas.offsetHeight
    canvas.width = W * window.devicePixelRatio
    canvas.height = H * window.devicePixelRatio
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio)

    ctx.clearRect(0, 0, W, H)

    const pad = { top: 12, right: 16, bottom: 24, left: 24 }
    const chartW = W - pad.left - pad.right
    const chartH = H - pad.top - pad.bottom
    const n = last12.length

    // Grid lines at 2, 4, 6, 8, 10
    ctx.strokeStyle = 'rgba(150,150,150,0.12)'
    ctx.lineWidth = 1
    for (const v of [2, 4, 6, 8, 10]) {
      const y = pad.top + chartH - ((v - 1) / 9) * chartH
      ctx.beginPath()
      ctx.moveTo(pad.left, y)
      ctx.lineTo(pad.left + chartW, y)
      ctx.stroke()
      ctx.fillStyle = 'rgba(150,150,150,0.5)'
      ctx.font = '10px system-ui'
      ctx.fillText(String(v), 0, y + 3)
    }

    // Points
    const pts = last12.map((c, i) => ({
      x: pad.left + (i / (n - 1)) * chartW,
      y: pad.top + chartH - ((c.happiness_rating! - 1) / 9) * chartH,
      val: c.happiness_rating!,
    }))

    // Gradient fill
    const grad = ctx.createLinearGradient(0, pad.top, 0, pad.top + chartH)
    grad.addColorStop(0, 'rgba(37,99,235,0.18)')
    grad.addColorStop(1, 'rgba(37,99,235,0)')
    ctx.beginPath()
    ctx.moveTo(pts[0].x, pad.top + chartH)
    pts.forEach(p => ctx.lineTo(p.x, p.y))
    ctx.lineTo(pts[pts.length - 1].x, pad.top + chartH)
    ctx.closePath()
    ctx.fillStyle = grad
    ctx.fill()

    // Line
    ctx.beginPath()
    ctx.strokeStyle = 'var(--accent)'
    ctx.lineWidth = 2
    ctx.lineJoin = 'round'
    pts.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y))
    ctx.stroke()

    // Dots
    pts.forEach(p => {
      ctx.beginPath()
      ctx.arc(p.x, p.y, 4, 0, Math.PI * 2)
      ctx.fillStyle = happinessColor(p.val)
      ctx.fill()
      ctx.strokeStyle = 'var(--surface-1)'
      ctx.lineWidth = 1.5
      ctx.stroke()
    })
  }, [last12])

  if (last12.length < 2) return null

  return (
    <canvas
      ref={canvasRef}
      style={{ width: '100%', height: 120, display: 'block' }}
    />
  )
}

export default function CheckinsClient({ checkins, currency }: Props) {
  const t = useT()
  const [expanded, setExpanded] = useState<string | null>(null)

  const submitted = checkins.filter(c => c.submitted_at)

  const thisMonth = new Date().toISOString().slice(0, 7)
  const thisMonthCheckins = submitted.filter(c => c.week_start.startsWith(thisMonth))
  const monthHappiness = thisMonthCheckins
    .map(c => c.happiness_rating)
    .filter((r): r is number => r !== null)
  const avgHappiness = monthHappiness.length > 0
    ? (monthHappiness.reduce((a, b) => a + b, 0) / monthHappiness.length).toFixed(1)
    : null

  return (
    <div style={{ padding: '24px', maxWidth: 720, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 24, paddingBottom: 16, borderBottom: '1px solid var(--border)' }}>
        <h1 className="page-title">{t.checkins.history}</h1>
        {submitted.length > 0 && (
          <p style={{ fontSize: 13, color: 'var(--text-2)', marginTop: 4 }}>
            {submitted.length} check-in{submitted.length !== 1 ? 's' : ''} submitted
          </p>
        )}
      </div>

      {submitted.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '64px 24px',
          background: 'var(--surface-1)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-card)',
        }}>
          <p style={{ fontSize: 32, marginBottom: 12 }}>📋</p>
          <p style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-1)', marginBottom: 8 }}>
            {t.checkins.noCheckins}
          </p>
          <p style={{ fontSize: 13, color: 'var(--text-2)' }}>
            Your weekly check-ins will appear here once you submit one.
          </p>
        </div>
      ) : (
        <>
          {/* Happiness chart */}
          {submitted.filter(c => c.happiness_rating !== null).length >= 2 && (
            <div style={{
              background: 'var(--surface-1)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-card)',
              padding: '16px 20px',
              marginBottom: 16,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <p className="section-title">{t.checkins.happinessTrend}</p>
                {avgHappiness && (
                  <span style={{ fontSize: 13, color: 'var(--text-2)' }}>
                    {t.checkins.avgThisMonth}{' '}
                    <strong style={{ color: 'var(--text-1)' }}>{avgHappiness} / 10</strong>
                  </span>
                )}
              </div>
              <HappinessChart checkins={submitted} />
            </div>
          )}

          {/* Check-in cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {submitted.map(checkin => {
              const isOpen = expanded === checkin.id
              return (
                <div
                  key={checkin.id}
                  style={{
                    background: 'var(--surface-1)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-card)',
                    overflow: 'hidden',
                  }}
                >
                  {/* Header — always visible */}
                  <button
                    onClick={() => setExpanded(isOpen ? null : checkin.id)}
                    style={{
                      width: '100%', textAlign: 'left',
                      padding: '14px 16px',
                      background: 'none', border: 'none', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: 12,
                    }}
                  >
                    {checkin.happiness_rating !== null && (
                      <div style={{
                        width: 36, height: 36, borderRadius: 8, flexShrink: 0,
                        background: `${happinessColor(checkin.happiness_rating)}18`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 16, fontWeight: 700,
                        color: happinessColor(checkin.happiness_rating),
                      }}>
                        {checkin.happiness_rating}
                      </div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)', marginBottom: 2 }}>
                        {formatWeek(checkin.week_start, checkin.week_end)}
                      </p>
                      {checkin.biggest_win && (
                        <p style={{
                          fontSize: 12, color: 'var(--text-2)',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          🏆 {checkin.biggest_win}
                        </p>
                      )}
                    </div>
                    <span style={{
                      fontSize: 11, color: 'var(--text-3)',
                      transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                      transition: 'transform 200ms ease',
                      flexShrink: 0,
                    }}>
                      ▼
                    </span>
                  </button>

                  {/* Expanded content */}
                  {isOpen && (
                    <div style={{ padding: '0 16px 16px', borderTop: '1px solid var(--border)' }}>
                      {/* Reflections */}
                      {[
                        { emoji: '🏆', label: 'Biggest win', value: checkin.biggest_win },
                        { emoji: '🎯', label: 'Main focus next week', value: checkin.main_focus },
                        { emoji: '🤝', label: 'Support needed', value: checkin.support_needed },
                        { emoji: '💡', label: 'Program suggestions', value: checkin.program_suggestions },
                        { emoji: '📝', label: 'Week summary', value: checkin.week_summary },
                      ].filter(f => f.value).map(f => (
                        <div key={f.label} style={{ marginTop: 12 }}>
                          <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
                            {f.emoji} {f.label}
                          </p>
                          <p style={{ fontSize: 13, color: 'var(--text-1)', lineHeight: 1.5 }}>{f.value}</p>
                        </div>
                      ))}

                      {/* Numbers grid */}
                      <div style={{
                        display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8,
                        marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)',
                      }}>
                        {[
                          { label: t.checkins.followers, value: checkin.followers_gained },
                          { label: t.checkins.replies, value: checkin.replies_received },
                          { label: t.checkins.callsBooked, value: checkin.calls_booked },
                          { label: t.checkins.closed, value: checkin.clients_closed },
                          { label: t.checkins.cash, value: checkin.cash_collected, isCurrency: true },
                          { label: t.checkins.revenue, value: checkin.revenue_contracted, isCurrency: true },
                          { label: t.numbers.adSpend, value: checkin.ad_spend, isCurrency: true },
                        ].filter(r => r.value !== null).map(row => (
                          <div
                            key={row.label}
                            style={{
                              background: 'var(--surface-2)',
                              borderRadius: 8, padding: '10px 12px',
                            }}
                          >
                            <p style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 2 }}>{row.label}</p>
                            <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-1)', fontVariantNumeric: 'tabular-nums' }}>
                              {row.isCurrency && row.value !== null
                                ? formatCurrency(row.value, currency)
                                : row.value}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
