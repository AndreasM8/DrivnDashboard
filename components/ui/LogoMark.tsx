'use client'

interface Props {
  height?: number
  maxWidth?: number
}

export default function LogoMark({ height = 32, maxWidth = 160 }: Props) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/drivn-logo.png"
      alt="Drivn"
      style={{
        height: 'auto',
        maxHeight: height,
        width: 'auto',
        maxWidth,
        display: 'block',
        flexShrink: 0,
      }}
    />
  )
}
