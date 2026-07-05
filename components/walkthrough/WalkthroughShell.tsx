'use client'
import { WalkthroughProvider } from './WalkthroughContext'
import WalkthroughOverlay from './WalkthroughOverlay'

interface Props {
  children: React.ReactNode
  blocked?: boolean // suppress auto-start when check-in or other gate is active
}

export default function WalkthroughShell({ children, blocked = false }: Props) {
  return (
    <WalkthroughProvider blocked={blocked}>
      {children}
      <WalkthroughOverlay />
    </WalkthroughProvider>
  )
}
