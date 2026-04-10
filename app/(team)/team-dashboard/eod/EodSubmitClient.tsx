'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { TeamMember, TeamCheckinTemplate, TeamEodReport, CheckinQuestion } from '@/types'

interface Props {
  member: TeamMember
  template: TeamCheckinTemplate | null
  existing: TeamEodReport | null
  today: string
}

type AnswerMap = Record<string, string | number | boolean>

export default function EodSubmitClient({ member, template, existing, today }: Props) {
  const router = useRouter()
  const questions: CheckinQuestion[] = template?.questions ?? []

  const initAnswers = (): AnswerMap => {
    if (existing) {
      const map: AnswerMap = {}
      for (const a of existing.answers) {
        map[a.question_id] = a.value
      }
      return map
    }
    const map: AnswerMap = {}
    for (const q of questions) {
      map[q.id] = q.type === 'number' ? '' : q.type === 'boolean' ? false : ''
    }
    return map
  }

  const [answers, setAnswers] = useState<AnswerMap>(initAnswers)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(!!existing?.submitted_at)
  const [error, setError] = useState<string | null>(null)

  function setAnswer(qid: string, value: string | number | boolean) {
    setAnswers(prev => ({ ...prev, [qid]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (submitting) return
    setSubmitting(true)
    setError(null)

    try {
      const answersArr = questions.map(q => ({ question_id: q.id, value: answers[q.id] ?? '' }))
      const res = await fetch('/api/team/eod', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ team_member_id: member.id, date: today, answers: answersArr }),
      })
      if (!res.ok) {
        const d = await res.json() as { error?: string }
        setError(d.error ?? 'Something went wrong')
        return
      }
      setSubmitted(true)
      setTimeout(() => router.push('/team-dashboard'), 1500)
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div style={{ maxWidth: 520, margin: '40px auto', textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-1)', margin: '0 0 8px' }}>
          EOD submitted!
        </h1>
        <p style={{ fontSize: 14, color: 'var(--text-2)' }}>
          Great work today. Redirecting you to the dashboard…
        </p>
      </div>
    )
  }

  if (questions.length === 0) {
    return (
      <div style={{ maxWidth: 520, margin: '40px auto', textAlign: 'center' }}>
        <p style={{ fontSize: 28, marginBottom: 12 }}>📋</p>
        <h1 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-1)', margin: '0 0 8px' }}>
          No EOD template configured
        </h1>
        <p style={{ fontSize: 14, color: 'var(--text-2)' }}>
          Ask your coach to set up your end-of-day questions.
        </p>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 560, margin: '0 auto' }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-1)', margin: '0 0 4px' }}>
          End of day report
        </h1>
        <p style={{ fontSize: 14, color: 'var(--text-2)', margin: 0 }}>
          Quick daily summary before you close up —{' '}
          {new Date(today).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' })}
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 24 }}>
          {questions.map(q => (
            <div
              key={q.id}
              style={{ background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: 'var(--radius-card)', padding: 16 }}
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
                  style={{
                    width: '100%', padding: '10px 12px',
                    background: 'var(--surface-2)', border: '1px solid var(--border)',
                    borderRadius: 8, fontSize: 15, color: 'var(--text-1)', outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              )}

              {q.type === 'text' && (
                <input
                  type="text"
                  value={String(answers[q.id] ?? '')}
                  onChange={e => setAnswer(q.id, e.target.value)}
                  required={q.required}
                  placeholder={q.placeholder ?? ''}
                  style={{
                    width: '100%', padding: '10px 12px',
                    background: 'var(--surface-2)', border: '1px solid var(--border)',
                    borderRadius: 8, fontSize: 14, color: 'var(--text-1)', outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              )}

              {q.type === 'textarea' && (
                <textarea
                  value={String(answers[q.id] ?? '')}
                  onChange={e => setAnswer(q.id, e.target.value)}
                  required={q.required}
                  placeholder={q.placeholder ?? ''}
                  rows={3}
                  style={{
                    width: '100%', padding: '10px 12px',
                    background: 'var(--surface-2)', border: '1px solid var(--border)',
                    borderRadius: 8, fontSize: 14, color: 'var(--text-1)', outline: 'none',
                    resize: 'vertical', boxSizing: 'border-box',
                  }}
                />
              )}

              {q.type === 'boolean' && (
                <div style={{ display: 'flex', gap: 8 }}>
                  {[true, false].map(v => (
                    <button
                      key={String(v)}
                      type="button"
                      onClick={() => setAnswer(q.id, v)}
                      style={{
                        padding: '8px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600,
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
          <div style={{ background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.2)', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#EF4444' }}>
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          style={{
            width: '100%', padding: '14px 24px',
            background: submitting ? 'var(--border-strong)' : '#2563EB',
            color: '#fff', border: 'none', borderRadius: 12,
            fontSize: 15, fontWeight: 700,
            cursor: submitting ? 'not-allowed' : 'pointer',
          }}
        >
          {submitting ? 'Submitting…' : 'Submit EOD report'}
        </button>
      </form>
    </div>
  )
}
