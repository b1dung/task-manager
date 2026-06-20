import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useNavigate, Link, useSearchParams } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { Clock } from 'lucide-react'
import { authApi } from '@/api/auth'
import { useAuthStore } from '@/stores/useAuthStore'
import { Button, Input, Modal } from '@/components/ui'
import { useToast } from '@/hooks/useToast'

const schema = z.object({
  email: z.string().email('Email không hợp lệ'),
  password: z.string().min(6, 'Mật khẩu ít nhất 6 ký tự'),
})
type FormData = z.infer<typeof schema>

function errorStatus(err: unknown): number | undefined {
  return (err as { response?: { status?: number } })?.response?.status
}

export function LoginPage() {
  const navigate = useNavigate()
  const { setAuth } = useAuthStore()
  const toast = useToast()
  const [searchParams] = useSearchParams()
  const [showPending, setShowPending] = useState(searchParams.get('pending') === '1')

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const { mutate, isPending } = useMutation({
    mutationFn: authApi.login,
    onSuccess: ({ user, accessToken, refreshToken }) => {
      setAuth(user, accessToken, refreshToken)
      navigate('/projects')
    },
    onError: (err) => {
      // Account exists but is not yet approved → show a blocking notice.
      if (errorStatus(err) === 403) setShowPending(true)
      else toast.error('Email hoặc mật khẩu không đúng')
    },
  })

  return (
    <div className="flex min-h-full items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <div className="mx-auto w-10 h-10 rounded-xl bg-accent flex items-center justify-center text-white font-bold mb-4">
            TB
          </div>
          <h1 className="text-2xl font-semibold text-fg">Đăng nhập</h1>
          <p className="mt-1 text-sm text-fg-muted">Chào mừng trở lại!</p>
        </div>

        <form onSubmit={handleSubmit((d) => mutate(d))} className="space-y-4">
          <Input
            {...register('email')}
            label="Email"
            type="email"
            placeholder="you@example.com"
            error={errors.email?.message}
            autoComplete="email"
          />
          <Input
            {...register('password')}
            label="Mật khẩu"
            type="password"
            placeholder="••••••••"
            error={errors.password?.message}
            autoComplete="current-password"
          />
          <Button type="submit" variant="primary" className="w-full" loading={isPending}>
            Đăng nhập
          </Button>
        </form>

        <p className="text-center text-sm text-fg-muted">
          Chưa có tài khoản?{' '}
          <Link to="/register" className="text-accent hover:underline">
            Đăng ký
          </Link>
        </p>
      </div>

      <Modal open={showPending} onClose={() => setShowPending(false)} title="Tài khoản đang chờ duyệt" size="sm">
        <div className="px-5 py-5 flex flex-col items-center text-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-warning/15 text-warning">
            <Clock className="w-6 h-6" />
          </div>
          <p className="text-sm text-fg">
            Tài khoản của bạn đã được tạo nhưng <span className="font-medium">đang chờ quản trị viên duyệt &amp; phân quyền</span>.
          </p>
          <p className="text-xs text-fg-muted">
            Bạn sẽ đăng nhập được ngay sau khi được chấp nhận. Vui lòng liên hệ quản trị viên nếu cần gấp.
          </p>
        </div>
        <div className="px-5 py-4 border-t border-border flex justify-center">
          <Button variant="primary" size="sm" onClick={() => setShowPending(false)}>Đã hiểu</Button>
        </div>
      </Modal>
    </div>
  )
}
