import Link from 'next/link'

export default function AskPage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{
        padding: '20px 24px 16px',
        borderBottom: '1px solid var(--border)',
        background: 'transparent',
        flexShrink: 0,
      }}>
        <h1 className="page-title">Your AI coaches</h1>
        <p style={{ fontSize: '13px', color: 'var(--text-2)', marginTop: '4px' }}>
          Get instant advice from Andreas or Sebastian
        </p>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
        <div style={{ maxWidth: '640px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>

          {/* Andreas card */}
          <Link href="/ask/andreas" style={{ textDecoration: 'none', display: 'block' }}>
            <div style={{
              background: 'var(--surface-1)',
              border: '1px solid var(--border)',
              borderRadius: '12px',
              padding: '20px',
              cursor: 'pointer',
              transition: 'border-color 120ms ease, background 120ms ease',
            }}
              onMouseEnter={e => {
                const el = e.currentTarget as HTMLDivElement
                el.style.borderColor = 'var(--border-strong)'
                el.style.background = 'var(--surface-2)'
              }}
              onMouseLeave={e => {
                const el = e.currentTarget as HTMLDivElement
                el.style.borderColor = 'var(--border)'
                el.style.background = 'var(--surface-1)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
                <div style={{
                  width: '52px', height: '52px', borderRadius: '12px',
                  background: 'linear-gradient(135deg, #FB923C, #EA580C)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '22px', flexShrink: 0,
                }}>
                  🎯
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                    <h2 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-1)', margin: 0 }}>Andreas</h2>
                    <span style={{
                      fontSize: '11px', fontWeight: 600,
                      background: 'rgba(234,88,12,0.15)', color: '#FB923C',
                      padding: '2px 8px', borderRadius: '99px',
                    }}>
                      Content & Brand
                    </span>
                  </div>
                  <p style={{ fontSize: '13px', color: 'var(--text-2)', lineHeight: 1.5, margin: 0 }}>
                    Expert in Instagram growth, reels, content strategy, and personal branding for fitness coaches. Ask Andreas anything about creating content that converts.
                  </p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '12px' }}>
                    {['Reel scripts', 'Hook generator', 'Content calendar', 'Caption writing'].map(tag => (
                      <span key={tag} style={{
                        fontSize: '11px', background: 'var(--surface-3)',
                        color: 'var(--text-2)', padding: '3px 10px', borderRadius: '99px',
                        border: '1px solid var(--border)',
                      }}>
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
                <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16" style={{ color: 'var(--text-3)', flexShrink: 0, marginTop: '4px' }}>
                  <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
                </svg>
              </div>
            </div>
          </Link>

          {/* Sebastian card */}
          <Link href="/ask/sebastian" style={{ textDecoration: 'none', display: 'block' }}>
            <div style={{
              background: 'var(--surface-1)',
              border: '1px solid var(--border)',
              borderRadius: '12px',
              padding: '20px',
              cursor: 'pointer',
              transition: 'border-color 120ms ease, background 120ms ease',
            }}
              onMouseEnter={e => {
                const el = e.currentTarget as HTMLDivElement
                el.style.borderColor = 'var(--border-strong)'
                el.style.background = 'var(--surface-2)'
              }}
              onMouseLeave={e => {
                const el = e.currentTarget as HTMLDivElement
                el.style.borderColor = 'var(--border)'
                el.style.background = 'var(--surface-1)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
                <div style={{
                  width: '52px', height: '52px', borderRadius: '12px',
                  background: 'linear-gradient(135deg, #3B82F6, #1D4ED8)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '22px', flexShrink: 0,
                }}>
                  💼
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                    <h2 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-1)', margin: 0 }}>Sebastian</h2>
                    <span style={{
                      fontSize: '11px', fontWeight: 600,
                      background: 'rgba(37,99,235,0.15)', color: '#60A5FA',
                      padding: '2px 8px', borderRadius: '99px',
                    }}>
                      Sales & DMs
                    </span>
                  </div>
                  <p style={{ fontSize: '13px', color: 'var(--text-2)', lineHeight: 1.5, margin: 0 }}>
                    Expert in DM conversations, sales calls, objection handling, and closing high-ticket coaching clients. Ask Sebastian for scripts and frameworks that actually close.
                  </p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '12px' }}>
                    {['DM openers', 'Objection handling', 'Follow-up sequences', 'Sales scripts'].map(tag => (
                      <span key={tag} style={{
                        fontSize: '11px', background: 'var(--surface-3)',
                        color: 'var(--text-2)', padding: '3px 10px', borderRadius: '99px',
                        border: '1px solid var(--border)',
                      }}>
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
                <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16" style={{ color: 'var(--text-3)', flexShrink: 0, marginTop: '4px' }}>
                  <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
                </svg>
              </div>
            </div>
          </Link>

          {/* Info banner */}
          <div style={{
            display: 'flex', alignItems: 'flex-start', gap: '10px',
            background: 'var(--surface-1)',
            border: '1px solid var(--border)',
            borderRadius: '10px',
            padding: '14px 16px',
            marginTop: '4px',
          }}>
            <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14" style={{ color: 'var(--text-3)', flexShrink: 0, marginTop: '1px' }}>
              <path fillRule="evenodd" d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-7-4a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM9 9a.75.75 0 0 0 0 1.5h.253a.25.25 0 0 1 .244.304l-.459 2.066A1.75 1.75 0 0 0 10.747 15H11a.75.75 0 0 0 0-1.5h-.253a.25.25 0 0 1-.244-.304l.459-2.066A1.75 1.75 0 0 0 9.253 9H9Z" clipRule="evenodd" />
            </svg>
            <p style={{ fontSize: '12px', color: 'var(--text-3)', lineHeight: 1.5, margin: 0 }}>
              Both advisors learn from your conversations and remember your niche, goals, and challenges over time — so advice gets more personalised with every session.
            </p>
          </div>

        </div>
      </div>
    </div>
  )
}
