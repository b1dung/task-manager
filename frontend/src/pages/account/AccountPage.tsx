import { useEffect, useState, useRef } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Archive, Camera, Clock3, Loader2, User, Mail, Shield, Lock, KeyRound, MonitorSmartphone } from 'lucide-react'
import { usersApi } from '@/api/users'
import { useAuthStore } from '@/stores/useAuthStore'
import { Avatar, Button, Select } from '@/components/ui'
import { useToast } from '@/hooks/useToast'
import { currentTimePreview, DEFAULT_TIMEZONE, TIMEZONE_LABELS, TIMEZONE_OPTIONS, type UserTimezone } from '@/lib/timezones'
import { useTranslation } from 'react-i18next'
import { authApi } from '@/api/auth'

const ROLE_LABEL: Record<string, string> = {
  admin: 'Admin', manager: 'Manager', member: 'Member', viewer: 'Viewer',
}

const inputCls =
  'w-full rounded-lg border border-border bg-bg-elevated px-3 py-2 text-sm text-fg placeholder:text-fg-subtle focus:outline-none focus:ring-2 focus:ring-accent transition-shadow'
const labelCls = 'flex items-center gap-1.5 text-xs font-medium text-fg-muted'

const SHOW_TWO_FACTOR = true

function apiErrorMessage(err: unknown, fallback: string): string {
  const msg = (err as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message
  if (Array.isArray(msg)) return msg[0] ?? fallback
  return msg || fallback
}

export function AccountPage() {
  const { t } = useTranslation()
  const { user, setUser } = useAuthStore()
  const toast = useToast()
  const queryClient = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)

  // ── Account information ─────────────────────────────────────────────────────
  const [fullName, setFullName] = useState(user?.fullName ?? '')
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [timezone, setTimezone] = useState<UserTimezone>(user?.timezone ?? DEFAULT_TIMEZONE)
  const [previewNow, setPreviewNow] = useState(() => new Date())

  useEffect(() => {
    const timer = window.setInterval(() => setPreviewNow(new Date()), 30_000)
    return () => window.clearInterval(timer)
  }, [])

  const { mutate: saveProfile, isPending: savingProfile } = useMutation({
    mutationFn: () => usersApi.update(user!.id, { fullName: fullName.trim() }),
    onSuccess: (updated) => {
      setUser({ ...user!, fullName: updated.fullName })
      toast.success(t('account.updated'))
    },
    onError: (err) => toast.error(apiErrorMessage(err, t('account.saveFailed'))),
  })

  const infoDirty = !!user && fullName.trim() !== user.fullName
  const infoValid = fullName.trim().length >= 2

  const { mutate: saveTimezone, isPending: savingTimezone } = useMutation({
    mutationFn: () => usersApi.update(user!.id, { timezone }),
    onSuccess: (updated) => {
      setUser({ ...user!, timezone: updated.timezone })
      toast.success(t('account.timezoneSaved'))
    },
    onError: (err) => toast.error(apiErrorMessage(err, t('account.timezoneFailed'))),
  })

  const MAX_SIZE_MB = 2
  const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user) return
    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error(t('account.avatarTypeError'))
      if (fileRef.current) fileRef.current.value = ''
      return
    }
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      toast.error(t('account.avatarTooLarge', { max: MAX_SIZE_MB }))
      if (fileRef.current) fileRef.current.value = ''
      return
    }
    setAvatarUploading(true)
    try {
      const updated = await usersApi.uploadAvatar(user.id, file)
      setUser({ ...user, avatarUrl: updated.avatarUrl })
      toast.success(t('account.avatarUpdated'))
    } catch (err) {
      toast.error(apiErrorMessage(err, t('account.avatarUploadFailed')))
    } finally {
      setAvatarUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  // ── Change password ─────────────────────────────────────────────────────────
  const [curPw, setCurPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')

  const { mutate: changePassword, isPending: changingPw } = useMutation({
    mutationFn: () => usersApi.changePassword(user!.id, { currentPassword: curPw, newPassword: newPw }),
    onSuccess: () => {
      toast.success(t('account.passwordUpdated'))
      setCurPw(''); setNewPw(''); setConfirmPw('')
    },
    onError: (err) => toast.error(apiErrorMessage(err, t('account.passwordFailed'))),
  })

  const pwDirty = !!(curPw || newPw || confirmPw)
  const mismatch = confirmPw.length > 0 && newPw !== confirmPw
  const pwValid = curPw.length > 0 && newPw.length >= 8 && newPw === confirmPw

  const resetInfo = () => setFullName(user?.fullName ?? '')
  const resetPw = () => { setCurPw(''); setNewPw(''); setConfirmPw('') }

  const { data: sessions = [] } = useQuery({
    queryKey: ['auth', 'sessions'],
    queryFn: authApi.sessions,
  })
  const { mutate: revokeSession, isPending: revokingSession } = useMutation({
    mutationFn: authApi.revokeSession,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['auth', 'sessions'] }),
  })
  const { mutate: revokeAll, isPending: revokingAll } = useMutation({
    mutationFn: authApi.revokeAllSessions,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['auth', 'sessions'] }),
  })
  const [twoFactorSetup, setTwoFactorSetup] = useState<{ secret: string; uri: string } | null>(null)
  const [twoFactorCode, setTwoFactorCode] = useState('')
  const setupTwoFactor = useMutation({
    mutationFn: authApi.setupTwoFactor,
    onSuccess: setTwoFactorSetup,
  })
  const enableTwoFactor = useMutation({
    mutationFn: () => authApi.enableTwoFactor(twoFactorCode),
    onSuccess: () => {
      setUser({ ...user!, twoFactorEnabled: true })
      setTwoFactorSetup(null)
      setTwoFactorCode('')
      toast.success('Đã bật xác thực hai lớp')
    },
  })
  const disableTwoFactor = useMutation({
    mutationFn: () => authApi.disableTwoFactor(twoFactorCode),
    onSuccess: () => {
      setUser({ ...user!, twoFactorEnabled: false })
      setTwoFactorCode('')
      toast.success('Đã tắt xác thực hai lớp')
    },
  })
  const exportData = useMutation({
    mutationFn: usersApi.exportOwnData,
    onSuccess: (data) => {
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }))
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `taskboard-data-${new Date().toISOString().slice(0, 10)}.json`
      anchor.click()
      URL.revokeObjectURL(url)
    },
  })

  if (!user) return null

  return (
    <div className="h-full overflow-y-auto bg-bg px-6 py-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <div>
          <h1 className="text-xl font-semibold text-fg">{t('account.title')}</h1>
          <p className="text-sm text-fg-muted mt-0.5">{t('account.subtitle')}</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* ── Block 1: Account information ── */}
        <div className="rounded-xl border border-border bg-bg-surface">
          <div className="flex items-center gap-2 px-6 py-3 border-b border-border">
            <User className="w-4 h-4 text-fg-muted" />
            <h2 className="text-sm font-semibold text-fg">{t('account.information')}</h2>
          </div>
          <div className="p-6 space-y-5">
            {/* Avatar */}
            <div className="flex items-center gap-5">
              <div className="relative shrink-0">
                <div className="w-20 h-20 rounded-full overflow-hidden ring-2 ring-border">
                  {user.avatarUrl
                    ? <img src={user.avatarUrl} alt={user.fullName} className="w-full h-full object-cover" />
                    : <Avatar name={user.fullName} avatarUrl={null} size="lg" className="!w-20 !h-20 !text-2xl" />}
                </div>
                {avatarUploading && (
                  <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40">
                    <Loader2 className="w-5 h-5 text-white animate-spin" />
                  </div>
                )}
                <button onClick={() => fileRef.current?.click()} disabled={avatarUploading}
                  className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full border-2 border-bg-surface bg-accent text-white shadow-sm hover:bg-accent/90 transition-colors disabled:opacity-50">
                  <Camera className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="space-y-0.5">
                <p className="text-sm font-medium text-fg">{user.fullName}</p>
                <button onClick={() => fileRef.current?.click()} disabled={avatarUploading}
                  className="text-xs text-accent hover:underline disabled:opacity-50">{t('account.changeAvatar')}</button>
              </div>
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleAvatarChange} />
            </div>

            <div className="space-y-1.5">
              <label className={labelCls}><User className="w-3.5 h-3.5" /> {t('account.name')}</label>
              <input className={inputCls} value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder={t('account.namePlaceholder')} />
            </div>
            <div className="space-y-1.5">
              <label className={labelCls}><Mail className="w-3.5 h-3.5" /> Email</label>
              <input className={`${inputCls} bg-bg-subtle text-fg-muted cursor-not-allowed`} value={user.email} readOnly />
            </div>
            <div className="space-y-1.5">
              <label className={labelCls}><Shield className="w-3.5 h-3.5" /> {t('account.role')}</label>
              <span className="inline-flex items-center rounded-[4px] border border-border bg-bg-subtle px-2.5 py-1 text-xs font-medium text-fg-muted">
                {ROLE_LABEL[user.role] ?? user.role}
              </span>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="ghost" size="sm" disabled={!infoDirty || savingProfile} onClick={resetInfo}>{t('common.cancel')}</Button>
              <Button variant="primary" size="sm" loading={savingProfile} disabled={!infoDirty || !infoValid} onClick={() => saveProfile()}>{t('account.saveChanges')}</Button>
            </div>
          </div>
        </div>

        {/* ── Block 2: Change password ── */}
        <div className="rounded-xl border border-border bg-bg-surface">
          <div className="flex items-center gap-2 px-6 py-3 border-b border-border">
            <KeyRound className="w-4 h-4 text-fg-muted" />
            <h2 className="text-sm font-semibold text-fg">{t('account.passwordSection')}</h2>
          </div>
          <div className="p-6 space-y-5">
            <div className="space-y-1.5">
              <label className={labelCls}><Lock className="w-3.5 h-3.5" /> {t('account.currentPassword')}</label>
              <input className={inputCls} type="password" value={curPw} onChange={(e) => setCurPw(e.target.value)} placeholder="••••••••" autoComplete="current-password" />
            </div>
            <div className="space-y-1.5">
              <label className={labelCls}><Lock className="w-3.5 h-3.5" /> {t('account.newPassword')}</label>
              <input className={inputCls} type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} placeholder={t('users.passwordPlaceholder')} autoComplete="new-password" />
              {newPw.length > 0 && newPw.length < 8 && <p className="text-xs text-danger">{t('auth.passwordMin8')}</p>}
            </div>
            <div className="space-y-1.5">
              <label className={labelCls}><Lock className="w-3.5 h-3.5" /> {t('account.confirmPassword')}</label>
              <input className={inputCls} type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} placeholder={t('account.confirmPlaceholder')} autoComplete="new-password" />
              {mismatch && <p className="text-xs text-danger">{t('account.passwordMismatch')}</p>}
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="ghost" size="sm" disabled={!pwDirty || changingPw} onClick={resetPw}>{t('common.cancel')}</Button>
              <Button variant="primary" size="sm" loading={changingPw} disabled={!pwValid} onClick={() => changePassword()}>{t('account.updatePassword')}</Button>
            </div>
          </div>
        </div>

        {/* ── Block 3: Timezone ── */}
        <div id="timezone" className="rounded-xl border border-border bg-bg-surface lg:col-span-2">
          <div className="flex items-center gap-2 px-4 py-3 sm:px-6 border-b border-border">
            <Clock3 className="w-4 h-4 text-fg-muted" />
            <h2 className="text-sm font-semibold text-fg">{t('account.timezone')}</h2>
          </div>
          <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-end sm:p-6">
            <div className="min-w-0 flex-1 space-y-2">
              <Select
                id="account-timezone"
                label={t('account.displayTimezone')}
                value={timezone}
                onChange={(event) => setTimezone(event.target.value as UserTimezone)}
                options={TIMEZONE_OPTIONS.map((value) => ({ value, label: TIMEZONE_LABELS[value] }))}
              />
              <p className="text-xs text-fg-muted" aria-live="polite">
                {currentTimePreview(timezone, previewNow, t('account.currentTime'))}
              </p>
              <p className="text-xs text-fg-subtle">{t('account.utcNotice')}</p>
            </div>
            <Button
              variant="primary"
              size="sm"
              loading={savingTimezone}
              disabled={timezone === (user.timezone ?? DEFAULT_TIMEZONE)}
              onClick={() => saveTimezone()}
              className="w-full sm:w-auto"
            >
              {t('account.saveTimezone')}
            </Button>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-bg-surface lg:col-span-2">
          <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6 border-b border-border">
            <div className="flex items-center gap-2">
              <MonitorSmartphone className="w-4 h-4 text-fg-muted" />
              <h2 className="text-sm font-semibold text-fg">Phiên đăng nhập</h2>
            </div>
            <Button variant="danger" size="sm" loading={revokingAll} disabled={!sessions.length} onClick={() => revokeAll()}>
              Thu hồi tất cả
            </Button>
          </div>
          <div className="divide-y divide-border">
            {sessions.map((session) => (
              <div key={session.id} className="flex items-center justify-between gap-4 px-4 py-3 sm:px-6">
                <div>
                  <p className="text-sm text-fg">Phiên tạo {new Date(session.createdAt).toLocaleString()}</p>
                  <p className="text-xs text-fg-muted">Hết hạn {new Date(session.expiresAt).toLocaleString()}</p>
                </div>
                <Button variant="ghost" size="sm" disabled={revokingSession} onClick={() => revokeSession(session.id)}>Thu hồi</Button>
              </div>
            ))}
            {!sessions.length && <p className="px-4 py-4 sm:px-6 text-sm text-fg-muted">Không có refresh session đang hoạt động.</p>}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-bg-surface lg:col-span-2">
          <div className="flex items-center gap-2 px-4 py-3 sm:px-6 border-b border-border">
            <Archive className="w-4 h-4 text-fg-muted" />
            <h2 className="text-sm font-semibold text-fg">Dữ liệu cá nhân</h2>
          </div>
          <div className="p-4 sm:p-6">
            <Button size="sm" loading={exportData.isPending} onClick={() => exportData.mutate()}>Tải dữ liệu của tôi (JSON)</Button>
          </div>
        </div>

        {SHOW_TWO_FACTOR && (
        <div className="rounded-xl border border-border bg-bg-surface lg:col-span-2">
          <div className="flex items-center gap-2 px-4 py-3 sm:px-6 border-b border-border">
            <Shield className="w-4 h-4 text-fg-muted" />
            <h2 className="text-sm font-semibold text-fg">Xác thực hai lớp (TOTP)</h2>
          </div>
          <div className="p-4 sm:p-6 space-y-4">
            <p className="text-sm text-fg-muted">Trạng thái: {user.twoFactorEnabled ? 'Đang bật' : 'Đang tắt'}</p>
            {twoFactorSetup && (
              <div className="rounded-lg bg-bg-subtle p-3 space-y-2">
                <p className="text-xs text-fg-muted">Nhập secret sau vào ứng dụng Authenticator:</p>
                <code className="block break-all text-sm text-fg">{twoFactorSetup.secret}</code>
              </div>
            )}
            {(twoFactorSetup || user.twoFactorEnabled) && (
              <input className={inputCls} inputMode="numeric" maxLength={6} value={twoFactorCode} onChange={(event) => setTwoFactorCode(event.target.value.replace(/\D/g, ''))} placeholder="000000" autoComplete="one-time-code" />
            )}
            {!user.twoFactorEnabled && !twoFactorSetup && <Button size="sm" loading={setupTwoFactor.isPending} onClick={() => setupTwoFactor.mutate()}>Thiết lập 2FA</Button>}
            {twoFactorSetup && <Button size="sm" loading={enableTwoFactor.isPending} disabled={twoFactorCode.length !== 6} onClick={() => enableTwoFactor.mutate()}>Xác nhận và bật</Button>}
            {user.twoFactorEnabled && <Button variant="danger" size="sm" loading={disableTwoFactor.isPending} disabled={twoFactorCode.length !== 6} onClick={() => disableTwoFactor.mutate()}>Tắt 2FA</Button>}
          </div>
        </div>
        )}
        </div>
      </div>
    </div>
  )
}
