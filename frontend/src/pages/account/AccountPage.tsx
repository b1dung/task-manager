import { useEffect, useState, useRef } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Camera, Clock3, Loader2, User, Mail, Shield, Lock, KeyRound } from 'lucide-react'
import { usersApi } from '@/api/users'
import { useAuthStore } from '@/stores/useAuthStore'
import { Avatar, Button, Select } from '@/components/ui'
import { useToast } from '@/hooks/useToast'
import { currentTimePreview, DEFAULT_TIMEZONE, TIMEZONE_LABELS, TIMEZONE_OPTIONS, type UserTimezone } from '@/lib/timezones'

const ROLE_LABEL: Record<string, string> = {
  admin: 'Admin', manager: 'Manager', member: 'Member', viewer: 'Viewer',
}

const inputCls =
  'w-full rounded-lg border border-border bg-bg-elevated px-3 py-2 text-sm text-fg placeholder:text-fg-subtle focus:outline-none focus:ring-2 focus:ring-accent transition-shadow'
const labelCls = 'flex items-center gap-1.5 text-xs font-medium text-fg-muted'

function apiErrorMessage(err: unknown, fallback: string): string {
  const msg = (err as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message
  if (Array.isArray(msg)) return msg[0] ?? fallback
  return msg || fallback
}

export function AccountPage() {
  const { user, setUser } = useAuthStore()
  const toast = useToast()
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
      toast.success('Đã cập nhật thông tin')
    },
    onError: (err) => toast.error(apiErrorMessage(err, 'Lưu thất bại')),
  })

  const infoDirty = !!user && fullName.trim() !== user.fullName
  const infoValid = fullName.trim().length >= 2

  const { mutate: saveTimezone, isPending: savingTimezone } = useMutation({
    mutationFn: () => usersApi.update(user!.id, { timezone }),
    onSuccess: (updated) => {
      setUser({ ...user!, timezone: updated.timezone })
      toast.success('Đã cập nhật múi giờ')
    },
    onError: (err) => toast.error(apiErrorMessage(err, 'Lưu múi giờ thất bại')),
  })

  const MAX_SIZE_MB = 10
  const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user) return
    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error('Chỉ hỗ trợ ảnh JPG, PNG, WEBP, GIF')
      if (fileRef.current) fileRef.current.value = ''
      return
    }
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      toast.error(`Ảnh quá lớn (tối đa ${MAX_SIZE_MB}MB)`)
      if (fileRef.current) fileRef.current.value = ''
      return
    }
    setAvatarUploading(true)
    try {
      const updated = await usersApi.uploadAvatar(user.id, file)
      setUser({ ...user, avatarUrl: updated.avatarUrl })
      toast.success('Cập nhật ảnh đại diện thành công')
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Upload ảnh thất bại'))
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
      toast.success('Đã đổi mật khẩu')
      setCurPw(''); setNewPw(''); setConfirmPw('')
    },
    onError: (err) => toast.error(apiErrorMessage(err, 'Đổi mật khẩu thất bại')),
  })

  const pwDirty = !!(curPw || newPw || confirmPw)
  const mismatch = confirmPw.length > 0 && newPw !== confirmPw
  const pwValid = curPw.length > 0 && newPw.length >= 8 && newPw === confirmPw

  const resetInfo = () => setFullName(user?.fullName ?? '')
  const resetPw = () => { setCurPw(''); setNewPw(''); setConfirmPw('') }

  if (!user) return null

  return (
    <div className="flex-1 overflow-y-auto bg-bg px-6 py-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <div>
          <h1 className="text-xl font-semibold text-fg">Tài khoản</h1>
          <p className="text-sm text-fg-muted mt-0.5">Quản lý thông tin cá nhân và mật khẩu của bạn</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* ── Block 1: Account information ── */}
        <div className="rounded-xl border border-border bg-bg-surface">
          <div className="flex items-center gap-2 px-6 py-3 border-b border-border">
            <User className="w-4 h-4 text-fg-muted" />
            <h2 className="text-sm font-semibold text-fg">Thông tin tài khoản</h2>
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
                  className="text-xs text-accent hover:underline disabled:opacity-50">Thay đổi ảnh đại diện</button>
              </div>
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={handleAvatarChange} />
            </div>

            <div className="space-y-1.5">
              <label className={labelCls}><User className="w-3.5 h-3.5" /> Họ và tên</label>
              <input className={inputCls} value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Nhập tên đầy đủ" />
            </div>
            <div className="space-y-1.5">
              <label className={labelCls}><Mail className="w-3.5 h-3.5" /> Email</label>
              <input className={`${inputCls} bg-bg-subtle text-fg-muted cursor-not-allowed`} value={user.email} readOnly />
            </div>
            <div className="space-y-1.5">
              <label className={labelCls}><Shield className="w-3.5 h-3.5" /> Vai trò</label>
              <span className="inline-flex items-center rounded-[4px] border border-border bg-bg-subtle px-2.5 py-1 text-xs font-medium text-fg-muted">
                {ROLE_LABEL[user.role] ?? user.role}
              </span>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="ghost" size="sm" disabled={!infoDirty || savingProfile} onClick={resetInfo}>Hủy</Button>
              <Button variant="primary" size="sm" loading={savingProfile} disabled={!infoDirty || !infoValid} onClick={() => saveProfile()}>Lưu thay đổi</Button>
            </div>
          </div>
        </div>

        {/* ── Block 2: Change password ── */}
        <div className="rounded-xl border border-border bg-bg-surface">
          <div className="flex items-center gap-2 px-6 py-3 border-b border-border">
            <KeyRound className="w-4 h-4 text-fg-muted" />
            <h2 className="text-sm font-semibold text-fg">Đổi mật khẩu</h2>
          </div>
          <div className="p-6 space-y-5">
            <div className="space-y-1.5">
              <label className={labelCls}><Lock className="w-3.5 h-3.5" /> Mật khẩu hiện tại</label>
              <input className={inputCls} type="password" value={curPw} onChange={(e) => setCurPw(e.target.value)} placeholder="••••••••" autoComplete="current-password" />
            </div>
            <div className="space-y-1.5">
              <label className={labelCls}><Lock className="w-3.5 h-3.5" /> Mật khẩu mới</label>
              <input className={inputCls} type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} placeholder="Tối thiểu 8 ký tự" autoComplete="new-password" />
              {newPw.length > 0 && newPw.length < 8 && <p className="text-xs text-danger">Mật khẩu mới phải có ít nhất 8 ký tự</p>}
            </div>
            <div className="space-y-1.5">
              <label className={labelCls}><Lock className="w-3.5 h-3.5" /> Xác nhận mật khẩu mới</label>
              <input className={inputCls} type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} placeholder="Nhập lại mật khẩu mới" autoComplete="new-password" />
              {mismatch && <p className="text-xs text-danger">Mật khẩu xác nhận không khớp</p>}
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="ghost" size="sm" disabled={!pwDirty || changingPw} onClick={resetPw}>Hủy</Button>
              <Button variant="primary" size="sm" loading={changingPw} disabled={!pwValid} onClick={() => changePassword()}>Cập nhật mật khẩu</Button>
            </div>
          </div>
        </div>

        {/* ── Block 3: Timezone ── */}
        <div id="timezone" className="rounded-xl border border-border bg-bg-surface lg:col-span-2">
          <div className="flex items-center gap-2 px-4 py-3 sm:px-6 border-b border-border">
            <Clock3 className="w-4 h-4 text-fg-muted" />
            <h2 className="text-sm font-semibold text-fg">Múi giờ</h2>
          </div>
          <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-end sm:p-6">
            <div className="min-w-0 flex-1 space-y-2">
              <Select
                id="account-timezone"
                label="Múi giờ hiển thị"
                value={timezone}
                onChange={(event) => setTimezone(event.target.value as UserTimezone)}
                options={TIMEZONE_OPTIONS.map((value) => ({ value, label: TIMEZONE_LABELS[value] }))}
              />
              <p className="text-xs text-fg-muted" aria-live="polite">
                {currentTimePreview(timezone, previewNow)}
              </p>
              <p className="text-xs text-fg-subtle">Dữ liệu thời gian vẫn được lưu dưới dạng UTC.</p>
            </div>
            <Button
              variant="primary"
              size="sm"
              loading={savingTimezone}
              disabled={timezone === (user.timezone ?? DEFAULT_TIMEZONE)}
              onClick={() => saveTimezone()}
              className="w-full sm:w-auto"
            >
              Lưu múi giờ
            </Button>
          </div>
        </div>
        </div>
      </div>
    </div>
  )
}
