import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { DEFAULT_TIMEZONE, formatZonedDate, type UserTimezone } from './timezones'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: string | Date | null | undefined, timezone: UserTimezone = DEFAULT_TIMEZONE): string {
  if (!date) return '—'
  return formatZonedDate(date, timezone)
}

export function formatRelative(date: string | Date, timezone: UserTimezone = DEFAULT_TIMEZONE): string {
  const now = new Date()
  const d = new Date(date)
  const diff = now.getTime() - d.getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'vừa xong'
  if (mins < 60) return `${mins} phút trước`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} giờ trước`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days} ngày trước`
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
