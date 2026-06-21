import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import { en, ja, vi } from './resources'

export type AppLanguage = 'en' | 'vi' | 'ja'

export function appLocale(): string {
  return i18n.resolvedLanguage === 'ja' ? 'ja-JP' : i18n.resolvedLanguage === 'en' ? 'en-US' : 'vi-VN'
}

function persistedLanguage(): AppLanguage | undefined {
  try {
    const raw = localStorage.getItem('auth-storage')
    const language = raw ? JSON.parse(raw)?.state?.user?.language : undefined
    if (language === 'en' || language === 'ja' || language === 'vi') return language
  } catch { /* fall back to Vietnamese */ }
  return undefined
}

void i18n.use(LanguageDetector).use(initReactI18next).init({
  resources: { en, vi, ja },
  lng: persistedLanguage() ?? (import.meta.env.MODE === 'test' ? 'en' : undefined),
  fallbackLng: 'en',
  supportedLngs: ['en', 'vi', 'ja'],
  detection: {
    order: ['localStorage', 'navigator', 'htmlTag'],
    caches: ['localStorage'],
    lookupLocalStorage: 'i18nextLng',
  },
  interpolation: { escapeValue: false },
  returnNull: false,
})

export default i18n
