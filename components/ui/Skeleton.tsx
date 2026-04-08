import type { CSSProperties } from 'react'

export default function Skeleton({
  width,
  height = 16,
  borderRadius = 4,
  style,
}: {
  width?: number | string
  height?: number | string
  borderRadius?: number | string
  style?: CSSProperties
}) {
  return (
    <div
      style={{
        width: width ?? '100%',
        height,
        borderRadius,
        backgroundImage:
          'linear-gradient(90deg, var(--surface-2) 25%, var(--surface-3) 50%, var(--surface-2) 75%)',
        backgroundSize: '800px 100%',
        animation: 'shimmer 1.4s ease-in-out infinite',
        flexShrink: 0,
        ...style,
      }}
    />
  )
}
