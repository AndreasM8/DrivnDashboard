'use client'

import { createContext, useContext } from 'react'
import type { Language } from '@/types'
import { getTranslations } from '@/lib/i18n'
import type en from '@/locales/en'

type Translations = typeof en

interface LanguageContextValue {
  language: Language
  t: Translations
}

export const LanguageContext = createContext<LanguageContextValue>({
  language: 'en',
  t: getTranslations('en'),
})

export function useT() {
  return useContext(LanguageContext).t
}

export function useLanguage() {
  return useContext(LanguageContext).language
}
