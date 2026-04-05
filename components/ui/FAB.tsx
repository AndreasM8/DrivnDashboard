'use client'

interface FABProps {
  onClick: () => void
  icon?: React.ReactNode
  label?: string
}

export default function FAB({ onClick, icon }: FABProps) {
  return (
    <button
      onClick={onClick}
      className="md:hidden"
      aria-label="Add"
      style={{
        position: 'fixed',
        bottom: 72,
        right: 16,
        width: 52,
        height: 52,
        borderRadius: '50%',
        background: 'var(--accent)',
        color: '#fff',
        border: 'none',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 4px 12px rgba(0,0,0,0.22)',
        fontSize: 26,
        zIndex: 50,
        transition: 'transform 80ms ease, box-shadow 80ms ease',
        WebkitTapHighlightColor: 'transparent',
      }}
      onTouchStart={e => {
        e.currentTarget.style.transform = 'scale(0.94)'
        e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.18)'
      }}
      onTouchEnd={e => {
        e.currentTarget.style.transform = ''
        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.22)'
      }}
    >
      {icon ?? (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      )}
    </button>
  )
}
