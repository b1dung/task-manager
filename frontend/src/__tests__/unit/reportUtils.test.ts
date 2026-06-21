import { describe, it, expect } from 'vitest'
import { formatDate, formatRelative, truncate, getInitials } from '@/lib/utils'

describe('formatDate', () => {
  it('formats ISO string using the default English locale', () => {
    expect(formatDate('2026-06-15T00:00:00.000Z')).toMatch(/06\/15\/2026/)
  })

  it('returns — for null', () => {
    expect(formatDate(null)).toBe('—')
  })

  it('returns — for undefined', () => {
    expect(formatDate(undefined)).toBe('—')
  })
})

describe('formatRelative', () => {
  it('returns "just now" for very recent dates', () => {
    const now = new Date().toISOString()
    expect(formatRelative(now)).toBe('just now')
  })

  it('returns minutes ago', () => {
    const twoMinsAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString()
    expect(formatRelative(twoMinsAgo)).toBe('2 minutes ago')
  })

  it('returns hours ago', () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
    expect(formatRelative(twoHoursAgo)).toBe('2 hours ago')
  })

  it('returns days ago', () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
    expect(formatRelative(threeDaysAgo)).toBe('3 days ago')
  })
})

describe('truncate', () => {
  it('truncates long strings', () => {
    expect(truncate('Hello World', 5)).toBe('Hello…')
  })

  it('does not truncate short strings', () => {
    expect(truncate('Hi', 5)).toBe('Hi')
  })

  it('does not truncate at exact length', () => {
    expect(truncate('Hello', 5)).toBe('Hello')
  })
})

describe('getInitials', () => {
  it('returns first letters of each word uppercased', () => {
    expect(getInitials('Alice Bob')).toBe('AB')
  })

  it('limits to 2 characters', () => {
    expect(getInitials('Alice Bob Charlie')).toBe('AB')
  })

  it('works with single name', () => {
    expect(getInitials('Alice')).toBe('A')
  })
})
