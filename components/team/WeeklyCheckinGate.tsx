'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { CheckinQuestion, TeamMember } from '@/types'

type AnswerMap = Record<string, string | number | boolean>

interface Props {
  member: TeamMember
  questions: CheckinQuestion[]
  weekStart: string
  weekEnd: string
}

export default function WeeklyCheckinGate({ member: _member, questions, weekStart, weekEnd }: Props) {
  const router = useRouter()
  const storageKey = `weekly_dismissed_${weekStart}`
  const [dismissed, setDismissed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    return sessionStorage.getItem(storageKey) === '1'
  })
  const [answers, setAnswers] = useState<AnswerMap>(() => {
    const m: AnswerMap = {}
    for (const q of questions) {
      m[q.id] = q.type === 'number' ? '' : q.type === 'boolean' ? false : ''
    }
    return m
  })
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (questions.length === 0) return null
  if (dismissed || submitted) return null

  function dismiss() {
    sessionStorage.setItem(storageKey, '1')
    setDismissed(true)
  }

  function setAnswer(qid: string, value: string | number | boolean) {
    setAnswers(prev => ({ ...prev, [qid]: value }))
  }

  const weekLabel = (() => {
    const start = new Date(weekStart)
    const end = new Date(weekEnd)
    return `${start.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} – ${end.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`
  })()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (submitting) return
    setSubmitting(true)
    setError(null)
    try {
      const answersArr = questions.map(q => ({ question_id: q.id, value: answers[q.id] ?? '' }))
      const res = await fetch('/api/team/weekly-checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers: answersArr }),
      })
      if (!res.ok) {
        const d = await res.json() as { error?: string }
        setError(d.error ?? 'Something went wrong')
        return
      }
      setSubmitted(true)
      router.refresh()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.75)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 16,
    }}>
      <div style={{
        background: 'var(--surface-1)',
        border: '1px solid var(--border)',
        borderRadius: 20,
        width: '100%',
        maxWidth: 520,
        maxHeight: '90vh',
        overflowY: 'auto',
        padding: 28,
      }}>
        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <h2 style={{ fontSize: 19, fontWeight: 700, color: 'var(--text-1)', margin: 0 }}>
              Weekly check-in
            </h2>
            <button
              onClick={dismiss}
              title="Remind me later"
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', fontSize: 12, padding: '4px 8px', borderRadius: 6 }}
            >
              Later
            </button>
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-2)', margin: 0 }}>
            Weekly reflection — {weekLabel}
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 20 }}>
            {questions.map(q => (
              <div
                key={q.id}
                style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 10, padding: 14 }}
              >
                <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)', display: 'block', marginBottom: 8 }}>
                  {q.label}
                  {q.required && <span style={{ color: '#EF4444', marginLeft: 4 }}>*</span>}
                </label>

                {q.type === 'number' && (
                  <input
                    type="number"
                    value={String(answers[q.id] ?? '')}
                    onChange={e => setAnswer(q.id, e.target.value === '' ? '' : Number(e.target.value))}
                    required={q.required}
                    placeholder={q.placeholder ?? '0'}
                    className="input-base"
                  />
                )}
                {q.type === 'text' && (
                  <input
                    type="text"
                    value={String(answers[q.id] ?? '')}
                    onChange={e => setAnswer(q.id, e.target.value)}
                    required={q.required}
                    placeholder={q.placeholder ?? ''}
                    className="input-base"
                  />
                )}
                {q.type === 'textarea' && (
                  <textarea
                    value={String(answers[q.id] ?? '')}
                    onChange={e => setAnswer(q.id, e.target.value)}
                    required={q.required}
                    placeholder={q.placeholder ?? ''}
                    rows={3}
                    className="input-base"
                    style={{ resize: 'vertical' }}
                  />
                )}
                {q.type === 'boolean' && (
                  <div style={{ display: 'flex', gap: 8 }}>
                    {([true, false] as const).map(v => (
                      <button
                        key={String(v)}
                        type="button"
                        onClick={() => setAnswer(q.id, v)}
                        style={{
                          padding: '7px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                          cursor: 'pointer', border: '2px solid',
                          borderColor: answers[q.id] === v ? 'var(--accent)' : 'var(--border)',
                          background: answers[q.id] === v ? 'rgba(37,99,235,0.1)' : 'transparent',
                          color: answers[q.id] === v ? 'var(--accent)' : 'var(--text-2)',
                          transition: 'all 120ms',
                        }}
                      >
                        {v ? 'Yes' : 'No'}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          {error && (
            <div style={{ background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.2)', borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: 13, color: '#EF4444' }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            style={{
              width: '100%', padding: '13px 24px',
              background: submitting ? 'var(--border-strong)' : '#2563EB',
              color: '#fff', border: 'none', borderRadius: 12,
              fontSize: 15, fontWeight: 700,
              cursor: submitting ? 'not-allowed' : 'pointer',
              transition: 'background 120ms',
            }}
          >
            {submitting ? 'Submitting…' : 'Submit weekly check-in'}
          </button>
        </form>
      </div>
    </div>
  )
}
