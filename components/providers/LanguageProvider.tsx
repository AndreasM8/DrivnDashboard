'use client'

import { LanguageContext } from '@/contexts/LanguageContext'
import { getTranslations } from '@/lib/i18n'
import type { Language } from '@/types'

export default function LanguageProvider({
  language,
  children,
}: {
  language: Language
  children: React.ReactNode
}) {
  return (
    <LanguageContext.Provider value={{ language, t: getTranslations(language) }}>
      {children}
    </LanguageContext.Provider>
  )
}
