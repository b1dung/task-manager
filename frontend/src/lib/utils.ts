import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { DEFAULT_TIMEZONE, formatZonedDate, type UserTimezone } from './timezones'
import i18n from '@/i18n'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: string | Date | null | undefined, timezone: UserTimezone = DEFAULT_TIMEZONE): string {
  if (!date) return '—'
  const locale = i18n.resolvedLanguage === 'ja' ? 'ja-JP' : i18n.resolvedLanguage === 'en' ? 'en-US' : 'vi-VN'
  return formatZonedDate(date, timezone, locale)
}

export function formatRelative(date: string | Date, timezone: UserTimezone = DEFAULT_TIMEZONE): string {
  const now = new Date()
  const d = new Date(date)
  const diff = now.getTime() - d.getTime()
  const mins = Math.floor(diff / 60000)
  const locale = i18n.resolvedLanguage === 'ja' ? 'ja-JP' : i18n.resolvedLanguage === 'en' ? 'en-US' : 'vi-VN'
  const relative = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
  if (mins < 1) return i18n.t('common.justNow')
  if (mins < 60) return relative.format(-mins, 'minute')
  const hours = Math.floor(mins / 60)
  if (hours < 24) return relative.format(-hours, 'hour')
  const days = Math.floor(hours / 24)
  if (days < 7) return relative.format(-days, 'day')
  return formatDate(d, timezone)
}

export function truncate(str: string, max: number): string {
  return str.length > max ? str.slice(0, max) + '…' : str
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}
