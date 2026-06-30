'use client'
import { useState, useEffect, useCallback } from 'react'

interface Insight {
  insight_text: string
  generated_at: string
}

interface Props {
  initialInsight: Insight | null
}

export default function WeeklyInsightCard({ initialInsight }: Props) {
  const [insight, setInsight] = useState<Insight | null>(initialInsight)
  const [loading, setLoading] = useState(!initialInsight)
  const [refreshing, setRefreshing] = useState(false)
  const [rateLimited, setRateLimited] = useState(false)

  const generate = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/insights/generate', { method: 'POST' })
      const data = await res.json() as { insight?: Insight; rateLimited?: boolean }
      if (data.insight) setInsight(data.insight)
      if (data.rateLimited) setRateLimited(true)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    if (!initialInsight) {
      generate()
    }
  }, [initialInsight, generate])

  async function handleRefresh() {
    setRefreshing(true)
    setRateLimited(false)
    await generate()
  }

  // Format generated_at nicely
  const generatedLabel = insight?.generated_at
    ? new Date(insight.generated_at).toLocaleDateString('en-GB', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null

  return (
    <div style={{
      background: 'var(--bg-elevated)',
      border: '1px solid var(--border)',
      borderTop: '2px solid transparent',
      backgroundImage: 'linear-gradient(var(--bg-elevated), var(--bg-elevated)), linear-gradient(90deg, var(--neon-indigo), var(--neon-cyan))',
      backgroundOrigin: 'border-box',
      backgroundClip: 'padding-box, border-box',
      borderRadius: 'var(--radius-card)',
      padding: '20px 24px',
      marginBottom: 24,
      position: 'relative',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Sparkle icon */}
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ color: 'var(--neon-indigo)', flexShrink: 0 }}>
            <path d="M12 2L14.4 9.6L22 12L14.4 14.4L12 22L9.6 14.4L2 12L9.6 9.6L12 2Z" fill="currentColor"/>
          </svg>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--neon-indigo)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            AI Insight — this week
          </span>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing || loading || rateLimited}
          style={{
            fontSize: 12,
            color: rateLimited ? 'var(--text-3)' : 'var(--text-2)',
            background: 'none',
            border: '1px solid var(--border)',
            borderRadius: 6,
            padding: '4px 10px',
            cursor: refreshing || loading || rateLimited ? 'not-allowed' : 'pointer',
            opacity: rateLimited ? 0.5 : 1,
            transition: 'all 120ms ease',
          }}
          title={rateLimited ? 'Can only refresh once per hour' : 'Refresh insight'}
        >
          {refreshing ? 'Generating…' : rateLimited ? 'Refreshed recently' : '↻ Refresh'}
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[100, 85, 70].map((w, i) => (
            <div
              key={i}
              style={{
                height: 14,
                borderRadius: 4,
                background: 'var(--bg-surface)',
                width: `${w}%`,
                animation: 'pulse 1.5s ease-in-out infinite',
              }}
            />
          ))}
          <p style={{ fontSize: 12, color: 'var(--text-3)', margin: '8px 0 0' }}>Analysing your week…</p>
        </div>
      ) : (
        <>
          <p style={{ fontSize: 14, color: 'var(--text-1)', lineHeight: 1.65, margin: '0 0 12px' }}>
            {insight?.insight_text ?? 'No insight available yet.'}
          </p>
          {generatedLabel && (
            <p style={{ fontSize: 11, color: 'var(--text-3)', margin: 0 }}>Generated {generatedLabel}</p>
          )}
        </>
      )}
    </div>
  )
}
