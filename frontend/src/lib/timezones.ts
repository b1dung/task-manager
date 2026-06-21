import { appLocale } from '@/i18n'

export const DEFAULT_TIMEZONE = 'Asia/Ho_Chi_Minh' as const

export const TIMEZONE_OPTIONS = [
  'Asia/Ho_Chi_Minh',
  'Asia/Tokyo',
  'Asia/Singapore',
  'UTC',
  'America/New_York',
  'Europe/London',
] as const

export type UserTimezone = (typeof TIMEZONE_OPTIONS)[number]

export const TIMEZONE_LABELS: Record<UserTimezone, string> = {
  'Asia/Ho_Chi_Minh': '(GMT +7:00) Bangkok, Hanoi, Jakarta',
  'Asia/Tokyo': '(GMT +9:00) Tokyo, Seoul',
  'Asia/Singapore': '(GMT +8:00) Singapore',
  UTC: '(GMT +0:00) UTC',
  'America/New_York': '(GMT -5:00) New York',
  'Europe/London': '(GMT +0:00) London',
}

function dateValue(value: string | Date): Date {
  // Due dates are DATE values, not instants. Noon UTC prevents them shifting to
  // another calendar day in every supported timezone.
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(`${value}T12:00:00.000Z`)
  }
  return value instanceof Date ? value : new Date(value)
}

export function formatZonedDate(
  value: string | Date,
  timezone: UserTimezone,
  locale = appLocale(),
  options: Intl.DateTimeFormatOptions = {},
): string {
  return new Intl.DateTimeFormat(locale, {
    day: '2-digit', month: '2-digit', year: 'numeric',
    ...options,
    timeZone: timezone,
  }).format(dateValue(value))
}

export function formatZonedDateTime(value: string | Date, timezone: UserTimezone, locale = appLocale()): string {
  return new Intl.DateTimeFormat(locale, {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
    timeZone: timezone,
  }).format(dateValue(value))
}

export function currentTimePreview(timezone: UserTimezone, value = new Date(), label = 'Current time'): string {
  const time = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit', minute: '2-digit', hour12: false, timeZone: timezone,
  }).format(value)
  return `${label}: ${time} ${timezone}`
}

export function todayInTimezone(timezone: UserTimezone, value = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric', month: '2-digit', day: '2-digit', timeZone: timezone,
  }).formatToParts(value)
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? ''
  return `${get('year')}-${get('month')}-${get('day')}`
}
