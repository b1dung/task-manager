import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, Check, ChevronDown, ChevronRight, Languages, LogOut, Moon, Settings, Sun, UserRound, Waves } from 'lucide-react'
import { authApi } from '@/api/auth'
import { usersApi } from '@/api/users'
import { Avatar, ConfirmDialog } from '@/components/ui'
import { cn } from '@/lib/utils'
import { type ThemeKey } from '@/lib/themes'
import { useAuthStore } from '@/stores/useAuthStore'
import { useUIStore } from '@/stores/useUIStore'

type Language = 'vi' | 'en'

const copy = {
  vi: { profile: 'Trang cá nhân', settings: 'Cài đặt tài khoản', language: 'Ngôn ngữ', appearance: 'Giao diện', notifications: 'Thông báo', logout: 'Đăng xuất', logoutTitle: 'Đăng xuất?', logoutMessage: 'Bạn có chắc muốn kết thúc phiên làm việc hiện tại?', cancel: 'Hủy', confirm: 'Đăng xuất' },
  en: { profile: 'Profile', settings: 'Account settings', language: 'Language', appearance: 'Appearance', notifications: 'Notifications', logout: 'Log out', logoutTitle: 'Log out?', logoutMessage: 'Are you sure you want to end your current session?', cancel: 'Cancel', confirm: 'Log out' },
}

const appearances: { value: ThemeKey; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'midnight', label: 'Dark', icon: Moon },
  { value: 'mint', label: 'Classic', icon: Waves },
]

export function UserAccountMenu() {
  const { user, setUser, logout } = useAuthStore()
  const { theme, setTheme } = useUIStore()
  const navigate = useNavigate()
  const ref = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [languageOpen, setLanguageOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)

  const language: Language = user?.language ?? 'vi'
  const t = copy[language]

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

  const saveLanguage = async (next: Language) => {
    const previous = language
    setUser({ ...user, language: next })
    setLanguageOpen(false)
    try { await usersApi.update(user.id, { language: next }) }
    catch { setUser({ ...user, language: previous }) }
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
              <button className={row} onClick={() => go('/account')}><UserRound className="h-4 w-4" />{t.profile}</button>
              <button className={row} onClick={() => go('/account?section=security')}><Settings className="h-4 w-4" />{t.settings}</button>
              <button className={row} onClick={() => go('/notifications')}><Bell className="h-4 w-4" />{t.notifications}</button>
            </div>

            <div className="border-t border-border p-2">
              <button className={row} onClick={() => setLanguageOpen((value) => !value)}>
                <Languages className="h-4 w-4" /><span className="flex-1 text-left">{t.language}</span>
                <span className="text-xs text-fg-subtle">{language === 'vi' ? 'Tiếng Việt' : 'English'}</span>
                <ChevronRight className={cn('h-3.5 w-3.5 transition-transform', languageOpen && 'rotate-90')} />
              </button>
              {languageOpen && (
                <div className="mx-2 mb-1 grid grid-cols-2 gap-1 rounded-lg bg-bg-elevated p-1">
                  {([['vi', 'Tiếng Việt'], ['en', 'English']] as const).map(([value, label]) => (
                    <button key={value} onClick={() => saveLanguage(value)} className={cn('flex items-center justify-center gap-1.5 rounded-md px-2 py-2 text-xs', language === value ? 'bg-bg-surface font-medium text-accent shadow-app-sm' : 'text-fg-muted hover:text-fg')}>
                      {language === value && <Check className="h-3 w-3" />}{label}
                    </button>
                  ))}
                </div>
              )}

              <div className="px-3 pb-1 pt-2 text-xs font-medium text-fg-subtle">{t.appearance}</div>
              <div className="grid grid-cols-3 gap-1 px-2 pb-2">
                {appearances.map(({ value, label, icon: Icon }) => (
                  <button key={value} onClick={() => saveAppearance(value)} className={cn('flex flex-col items-center gap-1.5 rounded-lg border px-2 py-2 text-[11px] transition-colors', theme === value ? 'border-accent bg-accent-subtle text-accent' : 'border-border text-fg-muted hover:bg-bg-subtle hover:text-fg')}>
                    <Icon className="h-4 w-4" />{label}
                  </button>
                ))}
              </div>
            </div>

            <div className="border-t border-border p-2">
              <button className={cn(row, 'text-danger hover:bg-danger/10 hover:text-danger')} onClick={() => { setOpen(false); setConfirmOpen(true) }}><LogOut className="h-4 w-4" />{t.logout}</button>
            </div>
          </div>
        )}
      </div>

      <ConfirmDialog open={confirmOpen} onClose={() => setConfirmOpen(false)} onConfirm={handleLogout} title={t.logoutTitle} message={t.logoutMessage} cancelLabel={t.cancel} confirmLabel={t.confirm} loading={loggingOut} />
    </>
  )
}
