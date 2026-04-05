'use client'
import { useEffect, useRef } from 'react'

interface BottomSheetProps {
  isOpen: boolean
  onClose: () => void
  height?: '50%' | '75%' | '90%' | '100%'
  title?: string
  children: React.ReactNode
}

export default function BottomSheet({
  isOpen,
  onClose,
  height = '90%',
  title,
  children,
}: BottomSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null)
  const startYRef = useRef<number>(0)
  const currentYRef = useRef<number>(0)

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  const handleTouchStart = (e: React.TouchEvent) => {
    startYRef.current = e.touches[0].clientY
    currentYRef.current = e.touches[0].clientY
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    currentYRef.current = e.touches[0].clientY
    const diff = currentYRef.current - startYRef.current
    if (diff > 0 && sheetRef.current) {
      sheetRef.current.style.transform = `translateY(${diff}px)`
      sheetRef.current.style.transition = 'none'
    }
  }

  const handleTouchEnd = () => {
    const diff = currentYRef.current - startYRef.current
    if (sheetRef.current) {
      sheetRef.current.style.transition = 'transform 250ms ease-out'
      if (diff > 80) {
        onClose()
        sheetRef.current.style.transform = `translateY(100%)`
        setTimeout(() => {
          if (sheetRef.current) sheetRef.current.style.transform = ''
        }, 260)
      } else {
        sheetRef.current.style.transform = ''
      }
    }
  }

  if (!isOpen) return null

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100 }}>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0,0,0,0.45)',
        }}
      />

      {/* Sheet */}
      <div
        ref={sheetRef}
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height,
          background: 'var(--surface-1)',
          borderRadius: '16px 16px 0 0',
          display: 'flex',
          flexDirection: 'column',
          transition: 'transform 250ms ease-out',
          overscrollBehavior: 'contain',
          boxShadow: '0 -4px 24px rgba(0,0,0,0.15)',
        }}
      >
        {/* Drag handle */}
        <div
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          style={{
            padding: '12px 0 8px',
            display: 'flex',
            justifyContent: 'center',
            flexShrink: 0,
            cursor: 'grab',
            touchAction: 'none',
          }}
        >
          <div
            style={{
              width: 40,
              height: 4,
              borderRadius: 2,
              background: 'var(--border)',
            }}
          />
        </div>

        {/* Title */}
        {title && (
          <div
            style={{
              padding: '0 20px 12px',
              fontWeight: 600,
              fontSize: 16,
              color: 'var(--text-1)',
              flexShrink: 0,
            }}
          >
            {title}
          </div>
        )}

        {/* Scrollable content */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            paddingBottom: 'calc(env(safe-area-inset-bottom) + 16px)',
          }}
        >
          {children}
        </div>
      </div>
    </div>
  )
}
