'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

export default function ExitViewAsButton() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleExit() {
    setLoading(true)
    await fetch('/api/admin/exit-view-as', { method: 'POST' })
    router.push('/admin')
    router.refresh()
  }

  return (
    <button
      onClick={handleExit}
      disabled={loading}
      style={{
        background: 'rgba(255,255,255,0.2)',
        border: '1px solid rgba(255,255,255,0.4)',
        color: '#fff',
        borderRadius: '6px',
        padding: '4px 12px',
        fontSize: '12px',
        fontWeight: 600,
        cursor: loading ? 'not-allowed' : 'pointer',
        opacity: loading ? 0.7 : 1,
        transition: 'opacity 120ms',
      }}
    >
      {loading ? 'Exiting…' : '← Exit'}
    </button>
  )
}
