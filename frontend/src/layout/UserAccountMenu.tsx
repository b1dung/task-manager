import { useEffect, useId, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, Check, ChevronDown, ChevronRight, Languages, LogOut, Moon, Settings, Sun, UserRound, Waves } from 'lucide-react'
import { authApi } from '@/api/auth'
import { usersApi } from '@/api/users'
import { Avatar, ConfirmDialog } from '@/components/ui'
import { cn } from '@/lib/utils'
import { type ThemeKey } from '@/lib/themes'
import { useAuthStore } from '@/stores/useAuthStore'
import { useUIStore } from '@/stores/useUIStore'
import { useTranslation } from 'react-i18next'
import type { AppLanguage } from '@/i18n'

const appearances: { value: ThemeKey; labelKey: string; icon: typeof Sun }[] = [
  { value: 'light', labelKey: 'account.light', icon: Sun },
  { value: 'midnight', labelKey: 'account.dark', icon: Moon },
  { value: 'mint', labelKey: 'account.classic', icon: Waves },
]

const languages: Array<{ value: AppLanguage; label: string }> = [
  { value: 'en', label: 'English' },
  { value: 'vi', label: 'Tiếng Việt' },
  { value: 'ja', label: '日本語' },
]

function LanguageFlag({ language, size = 30 }: { language: AppLanguage; size?: number }) {
  const rawId = useId()
  const clipId = `flag-${rawId.replace(/:/g, '')}`
  const style = {
    width: size,
    height: size,
    borderRadius: '50%',
    flexShrink: 0,
    boxShadow: 'rgba(0, 0, 0, 0.1) 0 0 0 1px',
  }

  if (language === 'vi') {
    return (
      <svg viewBox="0 0 30 20" preserveAspectRatio="xMidYMid slice" style={style} aria-hidden>
        <rect width="30" height="20" fill="#da251d" />
        <path fill="#ff0" d="M15 4l1.70 5.42h5.7l-4.61 3.35 1.76 5.42L15 14.84l-4.61 3.35 1.76-5.42-4.61-3.35h5.7z" />
      </svg>
    )
  }

  if (language === 'ja') {
    return (
      <svg viewBox="0 0 30 20" preserveAspectRatio="xMidYMid slice" style={style} aria-hidden>
        <rect width="30" height="20" fill="#fff" />
        <circle cx="15" cy="10" r="6" fill="#bc002d" />
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 60 30" preserveAspectRatio="xMidYMid slice" style={style} aria-hidden>
      <defs>
        <clipPath id={`${clipId}-outer`}><path d="M0 0v30h60V0z" /></clipPath>
        <clipPath id={`${clipId}-diagonal`}><path d="M30 15h30v15zv15h-30zh-30v-15zv-15h30z" /></clipPath>
      </defs>
      <g clipPath={`url(#${clipId}-outer)`}>
        <path d="M0 0v30h60V0z" fill="#012169" />
        <path d="M0 0l60 30m0-30L0 30" stroke="#fff" strokeWidth="6" />
        <path d="M0 0l60 30m0-30L0 30" clipPath={`url(#${clipId}-diagonal)`} stroke="#c8102e" strokeWidth="4" />
        <path d="M30 0v30M0 15h60" stroke="#fff" strokeWidth="10" />
        <path d="M30 0v30M0 15h60" stroke="#c8102e" strokeWidth="6" />
      </g>
    </svg>
  )
}

export function UserAccountMenu() {
  const { t, i18n } = useTranslation()
  const { user, setUser, logout } = useAuthStore()
  const { theme, setTheme } = useUIStore()
  const navigate = useNavigate()
  const ref = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [languageOpen, setLanguageOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)

  const language: AppLanguage = user?.language ?? 'en'
  const selectedLanguage = languages.find((item) => item.value === language) ?? languages[0]

  useEffect(() => {
    if (!open) return
    const close = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false)
    }
    const escape = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', escape)
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', escape) }
  }, [open])

  if (!user) return null

  const go = (path: string) => { setOpen(false); navigate(path) }

  const saveLanguage = async (next: AppLanguage) => {
    const previous = language
    setUser({ ...user, language: next })
    await i18n.changeLanguage(next)
    setLanguageOpen(false)
    try { await usersApi.update(user.id, { language: next }) }
    catch { setUser({ ...user, language: previous }); await i18n.changeLanguage(previous) }
  }

  const saveAppearance = async (next: ThemeKey) => {
    const previous = theme
    setTheme(next)
    setUser({ ...user, appearance: next })
    try { await usersApi.update(user.id, { appearance: next }) }
    catch { setTheme(previous); setUser({ ...user, appearance: previous }) }
  }

  const handleLogout = async () => {
    setLoggingOut(true)
    try { await authApi.logout() } catch { /* clear the local session regardless */ }
    logout()
    navigate('/login')
  }

  const row = 'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-fg-muted transition-colors hover:bg-bg-subtle hover:text-fg'

  return (
    <>
      <div ref={ref} className="relative">
        <button
          type="button"
          aria-label="User account menu"
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
          className={cn('flex items-center gap-2 rounded-xl border px-2 py-1.5 transition-colors', open ? 'border-border-bright bg-bg-elevated' : 'border-transparent hover:bg-bg-elevated')}
        >
          <Avatar name={user.fullName} avatarUrl={user.avatarUrl} size="sm" />
          <span className="hidden min-w-0 text-left sm:block">
            <span className="block max-w-36 truncate text-sm font-medium text-fg">{user.fullName}</span>
          </span>
          <ChevronDown className={cn('hidden h-3.5 w-3.5 text-fg-subtle transition-transform sm:block', open && 'rotate-180')} />
        </button>

        {open && (
          <div role="menu" className="fixed inset-x-3 top-16 z-50 overflow-hidden rounded-2xl border border-border bg-bg-surface shadow-app-lg sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-[330px]">
            <div className="flex items-center gap-3 border-b border-border px-4 py-4">
              <Avatar name={user.fullName} avatarUrl={user.avatarUrl} size="lg" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-fg">{user.fullName}</p>
                <p className="truncate text-xs text-fg-muted">{user.email}</p>
              </div>
            </div>

            <div className="p-2">
              <button className={row} onClick={() => go('/account')}><UserRound className="h-4 w-4" />{t('account.profile')}</button>
              <button className={row} onClick={() => go('/account?section=security')}><Settings className="h-4 w-4" />{t('account.settings')}</button>
              <button className={row} onClick={() => go('/notifications')}><Bell className="h-4 w-4" />{t('account.notification')}</button>
            </div>

            <div className="border-t border-border p-2">
              <div className="relative">
                <button
                  className={row}
                  aria-haspopup="listbox"
                  aria-expanded={languageOpen}
                  onClick={() => setLanguageOpen((value) => !value)}
                >
                  <Languages className="h-4 w-4" />
                  <span className="flex-1 text-left">{t('account.language')}</span>
                  <span className="flex items-center gap-1.5 text-xs text-fg-subtle">
                    <LanguageFlag language={selectedLanguage.value} size={20} />
                    {selectedLanguage.label}
                  </span>
                  <ChevronRight className={cn('h-3.5 w-3.5 transition-transform', languageOpen && 'rotate-90')} />
                </button>
                {languageOpen && (
                  <div
                    role="listbox"
                    aria-label={t('account.language')}
                    className="mx-2 mb-1 overflow-hidden rounded-xl border border-border bg-bg-elevated p-1 shadow-app-sm"
                  >
                    {languages.map((item) => (
                      <button
                        key={item.value}
                        role="option"
                        aria-selected={language === item.value}
                        onClick={() => saveLanguage(item.value)}
                        className={cn(
                          'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                          language === item.value
                            ? 'bg-bg-active font-medium text-accent'
                            : 'text-fg-muted hover:bg-bg-subtle hover:text-fg',
                        )}
                      >
                        <LanguageFlag language={item.value} />
                        <span className="flex-1 text-left">{item.label}</span>
                        {language === item.value && <Check className="h-4 w-4" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="px-3 pb-1 pt-2 text-xs font-medium text-fg-subtle">{t('account.appearance')}</div>
              <div className="grid grid-cols-3 gap-1 px-2 pb-2">
                {appearances.map(({ value, labelKey, icon: Icon }) => (
                  <button key={value} onClick={() => saveAppearance(value)} className={cn('flex flex-col items-center gap-1.5 rounded-lg border px-2 py-2 text-[11px] transition-colors', theme === value ? 'border-accent bg-accent-subtle text-accent' : 'border-border text-fg-muted hover:bg-bg-subtle hover:text-fg')}>
                    <Icon className="h-4 w-4" />{t(labelKey)}
                  </button>
                ))}
              </div>
            </div>

            <div className="border-t border-border p-2">
              <button className={cn(row, 'text-danger hover:bg-danger/10 hover:text-danger')} onClick={() => { setOpen(false); setConfirmOpen(true) }}><LogOut className="h-4 w-4" />{t('account.logout')}</button>
            </div>
          </div>
        )}
      </div>

      <ConfirmDialog open={confirmOpen} onClose={() => setConfirmOpen(false)} onConfirm={handleLogout} title={t('account.logoutTitle')} message={t('account.logoutMessage')} cancelLabel={t('common.cancel')} confirmLabel={t('account.logout')} loading={loggingOut} />
    </>
  )
}
