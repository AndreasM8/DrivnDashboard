import type { Metadata, Viewport } from 'next'
import { Geist, Inter, JetBrains_Mono } from 'next/font/google'
import './globals.css'
import DarkModeProvider from '@/components/providers/DarkModeProvider'

const geist = Geist({
  variable: '--font-geist',
  subsets: ['latin'],
})

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
})

const jetbrainsMono = JetBrains_Mono({
  variable: '--font-jetbrains',
  subsets: ['latin'],
  weight: ['400', '500'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Drivn — Coaching CRM',
  description: 'Business management for online fitness coaches',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Drivn',
  },
}

export const viewport: Viewport = {
  themeColor: '#3b82f6',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${geist.variable} ${inter.variable} ${jetbrainsMono.variable} h-full dark`}>
      <head>
        <link rel="apple-touch-icon" href="/icon-192.png" />
      </head>
      <body className="h-full antialiased">
        {/* Ambient orbs — behind all content */}
        <div className="ambient-orb" style={{ width: 600, height: 600, background: 'radial-gradient(circle, rgba(99,102,241,0.08) 0%, transparent 70%)', top: -200, left: -100 }} />
        <div className="ambient-orb" style={{ width: 500, height: 500, background: 'radial-gradient(circle, rgba(6,182,212,0.06) 0%, transparent 70%)', bottom: -100, right: -100 }} />
        <div className="ambient-orb" style={{ width: 400, height: 400, background: 'radial-gradient(circle, rgba(139,92,246,0.05) 0%, transparent 70%)', top: '40%', right: '25%' }} />
        <div style={{ position: 'relative', zIndex: 1, height: '100%' }}>
          <DarkModeProvider>
            {children}
          </DarkModeProvider>
        </div>
      </body>
    </html>
  )
}
