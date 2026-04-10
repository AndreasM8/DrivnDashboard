import en from '@/locales/en'
import no from '@/locales/no'
import type { Language } from '@/types'

const translations = { en, no } as const

export function getTranslations(lang: Language) {
  return translations[lang] ?? translations.en
}
