'use client'
import { WalkthroughProvider } from './WalkthroughContext'
import WalkthroughOverlay from './WalkthroughOverlay'

export default function WalkthroughShell({ children }: { children: React.ReactNode }) {
  return (
    <WalkthroughProvider>
      {children}
      <WalkthroughOverlay />
    </WalkthroughProvider>
  )
}
