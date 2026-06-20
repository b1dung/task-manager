import { describe, expect, it } from 'vitest'
import { currentTimePreview, formatZonedDate, formatZonedDateTime, todayInTimezone } from '@/lib/timezones'

describe('timezone formatting', () => {
  it('converts UTC instants to the selected timezone', () => {
    const instant = '2026-06-20T14:30:00.000Z'
    expect(formatZonedDateTime(instant, 'Asia/Ho_Chi_Minh', 'en-GB')).toContain('21:30')
    expect(formatZonedDateTime(instant, 'America/New_York', 'en-GB')).toContain('10:30')
  })

  it('does not shift DATE-only due dates across supported timezones', () => {
    expect(formatZonedDate('2026-06-20', 'America/New_York', 'en-CA')).toBe('2026-06-20')
    expect(formatZonedDate('2026-06-20', 'Asia/Tokyo', 'en-CA')).toBe('2026-06-20')
  })

  it('builds the current-time preview and zoned current date', () => {
    const instant = new Date('2026-06-20T23:30:00.000Z')
    expect(currentTimePreview('Asia/Ho_Chi_Minh', instant)).toBe('Current time: 06:30 Asia/Ho_Chi_Minh')
    expect(todayInTimezone('Asia/Ho_Chi_Minh', instant)).toBe('2026-06-21')
  })
})
