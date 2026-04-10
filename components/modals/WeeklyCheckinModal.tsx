'use client'

import { useState, useEffect } from 'react'
import type { WeeklyCheckin, CheckinPrefill } from '@/types'

interface Props {
  checkin: WeeklyCheckin | null
  prefill: CheckinPrefill
  currency: string
  weekStart: string
  weekEnd: string
  canSnooze: boolean
  mandatory?: boolean
  isLastCheckinOfMonth?: boolean
  onSubmitted: () => void
  onSnoozed: () => void
}

function formatWeekLabel(weekStart: string, weekEnd: string): string {
  const s = new Date(weekStart + 'T00:00:00Z')
  const e = new Date(weekEnd + 'T00:00:00Z')
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', timeZone: 'UTC' }
  const year = e.getUTCFullYear()
  return `${s.toLocaleDateString('en', opts)} – ${e.toLocaleDateString('en', { ...opts, year: 'numeric', timeZone: 'UTC' })}`
}

function happinessLabel(val: number): string {
  if (val <= 3) return "Tough week — we've got you"
  if (val <= 6) return 'Building momentum'
  if (val <= 8) return 'Solid week'
  return 'Killing it 🔥'
}

function happinessColor(val: number): string {
  if (val <= 3) return '#DC2626'
  if (val <= 6) return '#D97706'
  if (val <= 8) return '#16A34A'
  return 'var(--accent)'
}

export default function WeeklyCheckinModal({
  checkin,
  prefill,
  currency,
  weekStart,
  weekEnd,
  canSnooze,
  mandatory,
  isLastCheckinOfMonth,
  onSubmitted,
  onSnoozed,
}: Props) {
  const totalSteps = isLastCheckinOfMonth ? 3 : 2
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [monthlyConfirmed, setMonthlyConfirmed] = useState(false)
  const [biggestWin, setBiggestWin] = useState(checkin?.biggest_win ?? '')
  const [mainFocus, setMainFocus] = useState(checkin?.main_focus ?? '')
  const [supportNeeded, setSupportNeeded] = useState(checkin?.support_needed ?? '')
  const [programSuggestions, setProgramSuggestions] = useState(checkin?.program_suggestions ?? '')
  const [weekSummary, setWeekSummary] = useState(checkin?.week_summary ?? '')
  const [happinessRating, setHappinessRating] = useState<number | null>(checkin?.happiness_rating ?? null)
  const [followersGained, setFollowersGained] = useState(checkin?.followers_gained ?? prefill.followersGained)
  const [repliesReceived, setRepliesReceived] = useState(checkin?.replies_received ?? prefill.repliesReceived)
  const [callsBooked, setCallsBooked] = useState(checkin?.calls_booked ?? prefill.callsBooked)
  const [clientsClosed, setClientsClosed] = useState(checkin?.clients_closed ?? prefill.clientsClosed)
  const [cashCollected, setCashCollected] = useState(checkin?.cash_collected ?? prefill.cashCollected)
  const [revenueContracted, setRevenueContracted] = useState(checkin?.revenue_contracted ?? prefill.revenueContracted)
  const [adSpend, setAdSpend] = useState(checkin?.ad_spend != null ? String(checkin.ad_spend) : '')
  const [adSpendConfirmed, setAdSpendConfirmed] = useState(checkin?.ad_spend_confirmed ?? false)
  const [adSpendSkipped, setAdSpendSkipped] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [snoozing, setSnoozing] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true))
  }, [])

  const currencySymbol = new Intl.NumberFormat('en', { style: 'currency', currency })
    .formatToParts(0)
    .find(p => p.type === 'currency')?.value ?? currency

  async function handleSubmit() {
    setSubmitting(true)
    await fetch('/api/checkins', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        week_start: weekStart,
        week_end: weekEnd,
        action: 'submit',
        biggest_win: biggestWin || null,
        main_focus: mainFocus || null,
        support_needed: supportNeeded || null,
        program_suggestions: programSuggestions || null,
        week_summary: weekSummary || null,
        happiness_rating: happinessRating,
        followers_gained: followersGained,
        replies_received: repliesReceived,
        calls_booked: callsBooked,
        clients_closed: clientsClosed,
        cash_collected: cashCollected,
        revenue_contracted: revenueContracted,
        ad_spend: adSpendSkipped ? null : (adSpend ? Number(adSpend) : null),
        ad_spend_confirmed: adSpendConfirmed,
        system_followers_gained: prefill.followersGained,
        system_replies_received: prefill.repliesReceived,
        system_calls_booked: prefill.callsBooked,
        system_clients_closed: prefill.clientsClosed,
        system_cash_collected: prefill.cashCollected,
        system_revenue_contracted: prefill.revenueContracted,
      }),
    })
    setSubmitting(false)
    setShowSuccess(true)
    setTimeout(() => onSubmitted(), 1500)
  }

  async function handleSnooze() {
    setSnoozing(true)
    await fetch('/api/checkins', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ week_start: weekStart, week_end: weekEnd, action: 'snooze' }),
    })
    onSnoozed()
  }

  const canSubmitStep2 = adSpendConfirmed || adSpendSkipped
  const canSubmit = canSubmitStep2 && (!isLastCheckinOfMonth || step !== 3 || monthlyConfirmed)

  const cardStyle: React.CSSProperties = {
    background: 'var(--surface-1)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-card)',
    boxShadow: 'var(--shadow-card)',
    width: '100%',
    maxWidth: 600,
    maxHeight: '90vh',
    overflowY: 'auto',
    transform: visible ? 'translateY(0)' : 'translateY(40px)',
    opacity: visible ? 1 : 0,
    transition: 'transform 280ms cubic-bezier(0.34, 1.56, 0.64, 1), opacity 200ms ease',
  }

  if (showSuccess) {
    return (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '16px',
      }}>
        <div style={{
          ...cardStyle,
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          padding: '48px 32px', textAlign: 'center',
        }}>
          <div style={{
            width: 56, height: 56, borderRadius: '50%',
            background: 'rgba(22,163,74,0.12)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 28, marginBottom: 16,
          }}>
            ✓
          </div>
          <p style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-1)', marginBottom: 8 }}>
            Check-in submitted
          </p>
          <p style={{ fontSize: 14, color: 'var(--text-2)' }}>
            Great work this week. Keep building!
          </p>
        </div>
      </div>
    )
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.55)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '16px',
    }}>
      <div style={cardStyle}>
        {/* Header */}
        <div style={{
          padding: '20px 20px 0',
          borderBottom: '1px solid var(--border)',
          paddingBottom: 16,
          position: 'sticky', top: 0,
          background: 'var(--surface-1)',
          zIndex: 1,
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 4 }}>
            <div>
              <p style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-1)' }}>Weekly Check-in</p>
              <p style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 2 }}>
                {formatWeekLabel(weekStart, weekEnd)}
              </p>
              <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 1 }}>Takes about 2 minutes</p>
              {mandatory && (
                <p style={{ fontSize: 11, fontWeight: 600, color: '#D97706', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                  🔒 Required — complete to access the app
                </p>
              )}
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 4 }}>
              {Array.from({ length: totalSteps }, (_, i) => i + 1).map(s => (
                <div key={s} style={{
                  width: s === step ? 18 : 8,
                  height: 8,
                  borderRadius: 99,
                  background: s === step ? 'var(--accent)' : 'var(--border-strong)',
                  transition: 'all 200ms ease',
                }} />
              ))}
            </div>
          </div>
        </div>

        {/* Step 1: Reflection */}
        {step === 1 && (
          <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 20 }}>
            {[
              { emoji: '🏆', label: 'Biggest win this week', value: biggestWin, onChange: setBiggestWin, placeholder: 'What went really well?' },
              { emoji: '🎯', label: 'Main focus next week', value: mainFocus, onChange: setMainFocus, placeholder: 'What are you locking in on?' },
              { emoji: '🤝', label: 'Support needed', value: supportNeeded, onChange: setSupportNeeded, placeholder: 'Where do you need help or resources?' },
              { emoji: '💡', label: 'Program suggestions', value: programSuggestions, onChange: setProgramSuggestions, placeholder: 'Any feedback on your program or systems?' },
              { emoji: '📝', label: 'Week summary', value: weekSummary, onChange: setWeekSummary, placeholder: 'Anything else to note about this week?' },
            ].map(field => (
              <div key={field.label}>
                <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)', marginBottom: 8 }}>
                  {field.emoji} {field.label}
                </p>
                <textarea
                  value={field.value}
                  onChange={e => field.onChange(e.target.value)}
                  placeholder={field.placeholder}
                  rows={3}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 'var(--radius-card)',
                    border: '1px solid var(--border)',
                    background: 'var(--surface-2)',
                    color: 'var(--text-1)',
                    fontSize: 14,
                    resize: 'vertical',
                    outline: 'none',
                    boxSizing: 'border-box',
                    fontFamily: 'inherit',
                    lineHeight: 1.5,
                  }}
                />
              </div>
            ))}

            {/* Happiness rating */}
            <div>
              <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)', marginBottom: 10 }}>
                😊 How are you feeling about this week? (1–10)
              </p>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {Array.from({ length: 10 }, (_, i) => i + 1).map(n => {
                  const selected = happinessRating === n
                  return (
                    <button
                      key={n}
                      onClick={() => setHappinessRating(n)}
                      style={{
                        width: 40, height: 40,
                        borderRadius: 8,
                        border: selected ? 'none' : '1px solid var(--border)',
                        background: selected ? 'var(--accent)' : 'var(--surface-2)',
                        color: selected ? '#fff' : 'var(--text-1)',
                        fontSize: 14, fontWeight: selected ? 700 : 400,
                        cursor: 'pointer',
                        transform: selected ? 'scale(1.1)' : 'scale(1)',
                        transition: 'all 150ms ease',
                      }}
                    >
                      {n}
                    </button>
                  )
                })}
              </div>
              {happinessRating !== null && (
                <p style={{
                  marginTop: 10, fontSize: 13,
                  color: happinessColor(happinessRating),
                  fontWeight: 500,
                }}>
                  {happinessLabel(happinessRating)}
                </p>
              )}
            </div>

            <button
              onClick={() => setStep(2)}
              disabled={happinessRating === null}
              style={{
                width: '100%',
                height: 52,
                borderRadius: 'var(--radius-btn)',
                background: happinessRating !== null ? 'var(--accent)' : 'var(--surface-3)',
                color: happinessRating !== null ? '#fff' : 'var(--text-3)',
                border: 'none',
                fontSize: 15, fontWeight: 600,
                cursor: happinessRating !== null ? 'pointer' : 'not-allowed',
                transition: 'background 150ms ease',
              }}
            >
              Next — Review your numbers →
            </button>
          </div>
        )}

        {/* Step 2: Numbers */}
        {step === 2 && (
          <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-1)', marginBottom: 4 }}>
                Confirm your numbers for the week
              </p>
              <p style={{ fontSize: 13, color: 'var(--text-2)' }}>
                We&apos;ve pre-filled what we know — adjust anything that&apos;s off
              </p>
            </div>

            {[
              {
                label: 'New followers',
                value: followersGained,
                onChange: setFollowersGained,
                prefilled: true,
                prefix: null,
              },
              {
                label: 'Replies received',
                value: repliesReceived,
                onChange: setRepliesReceived,
                prefilled: true,
                prefix: null,
              },
              {
                label: 'Calls booked',
                value: callsBooked,
                onChange: setCallsBooked,
                prefilled: true,
                prefix: null,
              },
              {
                label: 'Clients closed',
                value: clientsClosed,
                onChange: setClientsClosed,
                prefilled: true,
                prefix: null,
              },
              {
                label: 'Cash collected',
                value: cashCollected,
                onChange: setCashCollected,
                prefilled: true,
                prefix: currencySymbol,
              },
              {
                label: 'Revenue contracted',
                value: revenueContracted,
                onChange: setRevenueContracted,
                prefilled: true,
                prefix: currencySymbol,
              },
            ].map(row => (
              <div key={row.label}>
                <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-1)', marginBottom: 6 }}>{row.label}</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {row.prefix && (
                    <span style={{ fontSize: 14, color: 'var(--text-2)', flexShrink: 0 }}>{row.prefix}</span>
                  )}
                  <input
                    type="number"
                    value={row.value ?? ''}
                    onChange={e => {
                      const raw = e.target.value
                      row.onChange(raw === '' ? 0 : Number(raw))
                    }}
                    onFocus={e => e.target.select()}
                    style={{
                      flex: 1, height: 44,
                      padding: '0 12px',
                      borderRadius: 'var(--radius-card)',
                      border: '1px solid var(--border)',
                      background: 'var(--surface-2)',
                      color: 'var(--text-1)',
                      fontSize: 18, fontWeight: 500,
                      outline: 'none',
                      boxSizing: 'border-box',
                      MozAppearance: 'textfield',
                      WebkitAppearance: 'none',
                    }}
                  />
                </div>
                {row.prefilled && (
                  <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 3 }}>from your data</p>
                )}
              </div>
            ))}

            {/* Ad spend */}
            <div style={{
              padding: 14,
              borderRadius: 'var(--radius-card)',
              border: adSpendConfirmed
                ? '1px solid rgba(22,163,74,0.4)'
                : '1px solid rgba(217,119,6,0.4)',
              background: adSpendConfirmed
                ? 'rgba(22,163,74,0.06)'
                : 'rgba(217,119,6,0.05)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-1)' }}>Ad spend</p>
                {adSpendConfirmed && (
                  <span style={{ fontSize: 13, color: '#16A34A', fontWeight: 600 }}>✓ Confirmed</span>
                )}
              </div>
              {!adSpendConfirmed && !adSpendSkipped && (
                <p style={{ fontSize: 12, color: '#D97706', marginBottom: 8, fontWeight: 500 }}>
                  Enter this week&apos;s ad spend to calculate ROAS
                </p>
              )}
              {!adSpendSkipped && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 14, color: 'var(--text-2)', flexShrink: 0 }}>{currencySymbol}</span>
                  <input
                    type="number"
                    value={adSpend}
                    onChange={e => {
                      setAdSpend(e.target.value)
                      setAdSpendConfirmed(false)
                    }}
                    placeholder="0"
                    style={{
                      flex: 1, height: 44,
                      padding: '0 12px',
                      borderRadius: 'var(--radius-card)',
                      border: '1px solid var(--border)',
                      background: 'var(--surface-2)',
                      color: 'var(--text-1)',
                      fontSize: 18, fontWeight: 500,
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
              )}
              {adSpend && !adSpendConfirmed && !adSpendSkipped && (
                <button
                  onClick={() => setAdSpendConfirmed(true)}
                  style={{
                    marginTop: 10, width: '100%', height: 40,
                    borderRadius: 'var(--radius-btn)',
                    background: 'rgba(217,119,6,0.12)',
                    border: '1px solid rgba(217,119,6,0.4)',
                    color: '#D97706', fontSize: 13, fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Confirm ad spend
                </button>
              )}
              {!adSpendConfirmed && !adSpendSkipped && (
                <button
                  onClick={() => setAdSpendSkipped(true)}
                  style={{
                    marginTop: 8, background: 'none', border: 'none',
                    fontSize: 12, color: 'var(--text-3)',
                    cursor: 'pointer', padding: '2px 0',
                  }}
                >
                  Skip ad spend
                </button>
              )}
              {adSpendSkipped && (
                <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4 }}>
                  Ad spend skipped.{' '}
                  <button
                    onClick={() => setAdSpendSkipped(false)}
                    style={{ background: 'none', border: 'none', fontSize: 12, color: 'var(--accent)', cursor: 'pointer', padding: 0 }}
                  >
                    Undo
                  </button>
                </p>
              )}
            </div>

            {isLastCheckinOfMonth ? (
              <button
                onClick={() => setStep(3)}
                disabled={!canSubmitStep2}
                style={{
                  width: '100%', height: 52,
                  borderRadius: 'var(--radius-btn)',
                  background: canSubmitStep2 ? 'var(--accent)' : 'var(--surface-3)',
                  color: canSubmitStep2 ? '#fff' : 'var(--text-3)',
                  border: 'none',
                  fontSize: 15, fontWeight: 600,
                  cursor: canSubmitStep2 ? 'pointer' : 'not-allowed',
                  transition: 'background 150ms ease',
                  marginTop: 4,
                }}
              >
                Next — Monthly review →
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={!canSubmitStep2 || submitting}
                style={{
                  width: '100%', height: 52,
                  borderRadius: 'var(--radius-btn)',
                  background: canSubmitStep2 && !submitting ? 'var(--accent)' : 'var(--surface-3)',
                  color: canSubmitStep2 && !submitting ? '#fff' : 'var(--text-3)',
                  border: 'none',
                  fontSize: 15, fontWeight: 600,
                  cursor: canSubmitStep2 && !submitting ? 'pointer' : 'not-allowed',
                  transition: 'background 150ms ease',
                  marginTop: 4,
                }}
              >
                {submitting ? 'Submitting…' : 'Submit check-in ✓'}
              </button>
            )}

            <button
              onClick={() => setStep(1)}
              style={{
                background: 'none', border: 'none',
                fontSize: 13, color: 'var(--text-3)',
                cursor: 'pointer', padding: '4px 0',
                textAlign: 'center', width: '100%',
              }}
            >
              ← Back to reflection
            </button>
          </div>
        )}

        {/* Step 3: Monthly review */}
        {step === 3 && isLastCheckinOfMonth && (() => {
          const monthName = new Date(weekEnd + 'T00:00:00Z').toLocaleDateString('en', { month: 'long', year: 'numeric', timeZone: 'UTC' })
          return (
            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-1)', marginBottom: 4 }}>
                  Monthly review
                </p>
                <p style={{ fontSize: 13, color: 'var(--text-2)' }}>
                  This is your last check-in for the month. Before you finish, take a moment to confirm your numbers are up to date.
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  'Ad spend logged for the month',
                  'Expenses up to date',
                  'Cash collected is accurate',
                ].map(item => (
                  <div key={item} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 'var(--radius-card)', background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
                    <span style={{ color: '#16A34A', fontSize: 16, flexShrink: 0 }}>✓</span>
                    <span style={{ fontSize: 13, color: 'var(--text-1)' }}>{item}</span>
                  </div>
                ))}
              </div>

              <p style={{ fontSize: 12, color: 'var(--text-3)' }}>
                If anything needs updating, head to Numbers after submitting.
              </p>

              {/* Confirmation checkbox */}
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', padding: '12px 14px', borderRadius: 'var(--radius-card)', border: monthlyConfirmed ? '1px solid rgba(22,163,74,0.4)' : '1px solid var(--border)', background: monthlyConfirmed ? 'rgba(22,163,74,0.06)' : 'var(--surface-2)', transition: 'all 150ms ease' }}>
                <input
                  type="checkbox"
                  checked={monthlyConfirmed}
                  onChange={e => setMonthlyConfirmed(e.target.checked)}
                  style={{ marginTop: 2, flexShrink: 0, width: 16, height: 16, cursor: 'pointer', accentColor: '#16A34A' }}
                />
                <span style={{ fontSize: 13, color: 'var(--text-1)', fontWeight: monthlyConfirmed ? 500 : 400 }}>
                  I confirm my numbers, expenses and ad spend are up to date for {monthName}
                </span>
              </label>

              <button
                onClick={handleSubmit}
                disabled={!monthlyConfirmed || submitting}
                style={{
                  width: '100%', height: 52,
                  borderRadius: 'var(--radius-btn)',
                  background: monthlyConfirmed && !submitting ? 'var(--accent)' : 'var(--surface-3)',
                  color: monthlyConfirmed && !submitting ? '#fff' : 'var(--text-3)',
                  border: 'none',
                  fontSize: 15, fontWeight: 600,
                  cursor: monthlyConfirmed && !submitting ? 'pointer' : 'not-allowed',
                  transition: 'background 150ms ease',
                  marginTop: 4,
                }}
              >
                {submitting ? 'Submitting…' : 'Submit check-in ✓'}
              </button>

              <button
                onClick={() => setStep(2)}
                style={{
                  background: 'none', border: 'none',
                  fontSize: 13, color: 'var(--text-3)',
                  cursor: 'pointer', padding: '4px 0',
                  textAlign: 'center', width: '100%',
                }}
              >
                ← Back to numbers
              </button>
            </div>
          )
        })()}

        {/* Snooze link */}
        {canSnooze && !showSuccess && (
          <div style={{
            padding: '0 20px 20px',
            textAlign: 'center',
          }}>
            <button
              onClick={handleSnooze}
              disabled={snoozing}
              style={{
                background: 'none', border: 'none',
                fontSize: 12, color: 'var(--text-3)',
                cursor: snoozing ? 'default' : 'pointer', padding: '4px 8px',
                textDecoration: 'underline',
                opacity: snoozing ? 0.5 : 1,
              }}
            >
              {snoozing ? 'Snoozing…' : 'Remind me tomorrow'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
