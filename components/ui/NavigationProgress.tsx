'use client'
import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'

export default function NavigationProgress() {
  const pathname = usePathname()
  const [visible, setVisible] = useState(false)
  const [width, setWidth] = useState(0)
  const [completing, setCompleting] = useState(false)
  const prevPath = useRef(pathname)
  const rampTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function startProgress() {
    if (rampTimer.current) clearTimeout(rampTimer.current)
    if (hideTimer.current) clearTimeout(hideTimer.current)
    setCompleting(false)
    setVisible(true)
    setWidth(0)
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setWidth(70)
      })
    })
  }

  function completeProgress() {
    setCompleting(true)
    setWidth(100)
    hideTimer.current = setTimeout(() => {
      setVisible(false)
      setWidth(0)
      setCompleting(false)
    }, 400)
  }

  useEffect(() => {
    if (pathname !== prevPath.current) {
      prevPath.current = pathname
      completeProgress()
    }
  }, [pathname])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const target = e.target as HTMLElement
      const anchor = target.closest('a')
      if (!anchor) return
      const href = anchor.getAttribute('href')
      if (!href || !href.startsWith('/')) return
      if (href === pathname) return
      startProgress()
    }
    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [pathname])

  if (!visible) return null

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        height: 3,
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          height: '100%',
          width: `${width}%`,
          background: 'var(--accent)',
          borderRadius: '0 2px 2px 0',
          transition: completing
            ? 'width 200ms ease-out, opacity 300ms ease 200ms'
            : 'width 800ms cubic-bezier(0.1, 0.9, 0.2, 1)',
          opacity: completing && width === 100 ? 0 : 1,
        }}
      />
    </div>
  )
}
