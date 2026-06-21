import { describe, expect, it } from 'vitest'
import i18n from '@/i18n'
import { en, ja, vi } from '@/i18n/resources'

function keys(value: unknown, prefix = ''): string[] {
  if (!value || typeof value !== 'object') return [prefix]
  return Object.entries(value).flatMap(([key, child]) => keys(child, prefix ? `${prefix}.${key}` : key))
}

describe('translations', () => {
  it('keeps the same translation keys in EN, VI, and JA', () => {
    const expected = keys(en.translation).sort()
    expect(keys(vi.translation).sort()).toEqual(expected)
    expect(keys(ja.translation).sort()).toEqual(expected)
  })

  it.each([
    ['en', 'Account'],
    ['vi', 'Tài khoản'],
    ['ja', 'アカウント'],
  ])('switches language to %s', async (language, expected) => {
    await i18n.changeLanguage(language)
    expect(i18n.t('account.title')).toBe(expected)
  })
})
