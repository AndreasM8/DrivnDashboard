'use client'
interface Props {
  size?: number
}
export default function LogoMark({ size = 28 }: Props) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0, display: 'block' }}>
      <rect width="32" height="32" rx="8" fill="#6366F1"/>
      <path
        d="M10 8h7C21.4 8 25 11.6 25 16S21.4 24 17 24h-7V8zm3.5 3v10H17c2.8 0 4.5-2 4.5-5S19.8 11 17 11h-3.5z"
        fill="white"
      />
    </svg>
  )
}
