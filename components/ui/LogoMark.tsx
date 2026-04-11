'use client'

interface Props {
  size?: number
}

// Temporary placeholder — replace src with /drivn-logo.png once file is added to /public
export default function LogoMark({ size = 28 }: Props) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/drivn-logo.png"
      alt="Drivn"
      width={size}
      height={size}
      style={{ width: size, height: size, objectFit: 'contain', flexShrink: 0, display: 'block' }}
      onError={(e) => {
        // Fallback: white D on transparent if logo not found
        const target = e.currentTarget
        target.style.display = 'none'
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
        svg.setAttribute('width', String(size))
        svg.setAttribute('height', String(size))
        svg.setAttribute('viewBox', '0 0 32 32')
        svg.setAttribute('fill', 'none')
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
        path.setAttribute('d', 'M8 6h8C21 6 26 10.5 26 16S21 26 16 26H8V6zm4 4v12h4c3 0 6-2.5 6-6s-3-6-6-6h-4z')
        path.setAttribute('fill', 'white')
        svg.appendChild(path)
        target.parentElement?.insertBefore(svg, target.nextSibling)
      }}
    />
  )
}
