import { useState, useRef } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Camera, Loader2, Check, User, Mail, Shield } from 'lucide-react'
import { usersApi } from '@/api/users'
import { useAuthStore } from '@/stores/useAuthStore'
import { Avatar } from '@/components/ui'
import { cn } from '@/lib/utils'
import { useToast } from '@/hooks/useToast'

const ROLE_LABEL: Record<string, string> = {
  admin: 'Admin',
  manager: 'Manager',
  member: 'Member',
  viewer: 'Viewer',
}

export function AccountPage() {
  const { user, setUser } = useAuthStore()
  const toast = useToast()
  const fileRef = useRef<HTMLInputElement>(null)

  const [fullName, setFullName] = useState(user?.fullName ?? '')
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [saved, setSaved] = useState(false)

  const { mutate: saveProfile, isPending } = useMutation({
    mutationFn: () => usersApi.update(user!.id, { fullName: fullName.trim() }),
    onSuccess: (updated) => {
      setUser({ ...user!, fullName: updated.fullName })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    },
    onError: () => toast.error('Lưu thất bại'),
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
      toast.error(`Ảnh quá lớn. Vui lòng chọn ảnh nhỏ hơn ${MAX_SIZE_MB}MB (hiện tại: ${(file.size / 1024 / 1024).toFixed(1)}MB)`)
      if (fileRef.current) fileRef.current.value = ''
      return
    }

    setAvatarUploading(true)
    try {
      const updated = await usersApi.uploadAvatar(user.id, file)
      setUser({ ...user, avatarUrl: updated.avatarUrl })
      toast.success('Cập nhật ảnh đại diện thành công')
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg ? `Upload thất bại: ${msg}` : 'Upload ảnh thất bại')
    } finally {
      setAvatarUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const isDirty = fullName.trim() !== (user?.fullName ?? '')

  if (!user) return null

  return (
    <div className="flex-1 overflow-y-auto bg-bg px-6 py-8">
      <div className="mx-auto max-w-2xl space-y-6">

        {/* Header */}
        <div>
          <h1 className="text-xl font-semibold text-fg">Tài khoản</h1>
          <p className="text-sm text-fg-muted mt-0.5">Quản lý thông tin cá nhân của bạn</p>
        </div>

        {/* Avatar card */}
        <div className="rounded-xl border border-border bg-bg-surface p-6">
          <h2 className="text-sm font-semibold text-fg mb-4">Ảnh đại diện</h2>
          <div className="flex items-center gap-5">
            <div className="relative shrink-0">
              <div className="w-20 h-20 rounded-full overflow-hidden ring-2 ring-border">
                {user.avatarUrl ? (
                  <img
                    src={user.avatarUrl}
                    alt={user.fullName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Avatar name={user.fullName} avatarUrl={null} size="lg" className="!w-20 !h-20 !text-2xl" />
                )}
              </div>
              {avatarUploading && (
                <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40">
                  <Loader2 className="w-5 h-5 text-white animate-spin" />
                </div>
              )}
              <button
                onClick={() => fileRef.current?.click()}
                disabled={avatarUploading}
                className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full border-2 border-bg-surface bg-accent text-white shadow-sm hover:bg-accent/90 transition-colors disabled:opacity-50"
              >
                <Camera className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-1">
              <p className="text-sm font-medium text-fg">{user.fullName}</p>
              <p className="text-xs text-fg-muted">{user.email}</p>
              <button
                onClick={() => fileRef.current?.click()}
                disabled={avatarUploading}
                className="text-xs text-accent hover:underline disabled:opacity-50"
              >
                Thay đổi ảnh
              </button>
            </div>

            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={handleAvatarChange}
            />
          </div>
        </div>

        {/* Profile info card */}
        <div className="rounded-xl border border-border bg-bg-surface p-6 space-y-5">
          <h2 className="text-sm font-semibold text-fg">Thông tin cá nhân</h2>

          {/* Full name */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-xs font-medium text-fg-muted">
              <User className="w-3.5 h-3.5" />
              Họ và tên
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full rounded-lg border border-border bg-bg-elevated px-3 py-2 text-sm text-fg placeholder:text-fg-subtle focus:outline-none focus:ring-2 focus:ring-accent transition-shadow"
              placeholder="Nhập tên đầy đủ"
            />
          </div>

          {/* Email — read-only */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-xs font-medium text-fg-muted">
              <Mail className="w-3.5 h-3.5" />
              Email
            </label>
            <input
              type="email"
              value={user.email}
              readOnly
              className="w-full rounded-lg border border-border bg-bg-subtle px-3 py-2 text-sm text-fg-muted cursor-not-allowed"
            />
          </div>

          {/* Role — read-only */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-xs font-medium text-fg-muted">
              <Shield className="w-3.5 h-3.5" />
              Vai trò
            </label>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center rounded-[4px] border border-border bg-bg-subtle px-2.5 py-1 text-xs font-medium text-fg-muted">
                {ROLE_LABEL[user.role] ?? user.role}
              </span>
            </div>
          </div>

          {/* Save button */}
          <div className="flex justify-end pt-1">
            <button
              onClick={() => saveProfile()}
              disabled={!isDirty || isPending}
              className={cn(
                'inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors',
                isDirty && !isPending
                  ? 'bg-accent text-white hover:bg-accent/90'
                  : 'bg-bg-subtle text-fg-muted cursor-not-allowed',
              )}
            >
              {isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : saved ? (
                <Check className="w-4 h-4" />
              ) : null}
              {saved ? 'Đã lưu' : 'Lưu thay đổi'}
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}
