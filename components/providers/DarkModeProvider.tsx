'use client'
import { createContext, useContext, useEffect, useState } from 'react'

interface DarkModeContextValue {
  dark: boolean
  toggle: () => void
}

const DarkModeContext = createContext<DarkModeContextValue>({ dark: false, toggle: () => {} })

export function useDarkMode() { return useContext(DarkModeContext) }

export default function DarkModeProvider({ children }: { children: React.ReactNode }) {
  // Default to dark — the inline script in layout.tsx already set the class,
  // so we just need React state to match what's on the DOM.
  const [dark, setDark] = useState(true)

  useEffect(() => {
    const saved = localStorage.getItem('theme')
    if (saved === 'light') {
      setDark(false)
      document.documentElement.classList.remove('dark')
    } else {
      // 'dark' or no preference → dark mode
      setDark(true)
      document.documentElement.classList.add('dark')
    }
  }, [])

  function toggle() {
    const next = !dark
    setDark(next)
    if (next) {
      document.documentElement.classList.add('dark')
      localStorage.setItem('theme', 'dark')
    } else {
      document.documentElement.classList.remove('dark')
      localStorage.setItem('theme', 'light')
    }
  }

  return (
    <DarkModeContext.Provider value={{ dark, toggle }}>
      {children}
    </DarkModeContext.Provider>
  )
}
