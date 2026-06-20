import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useNavigate, Link, useSearchParams } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { Clock } from 'lucide-react'
import { authApi } from '@/api/auth'
import { useAuthStore } from '@/stores/useAuthStore'
import { Button, Input } from '@/components/ui'
import { useToast } from '@/hooks/useToast'

const schema = z.object({
  email: z.string().email('Email không hợp lệ'),
  password: z.string().min(6, 'Mật khẩu ít nhất 6 ký tự'),
})
type FormData = z.infer<typeof schema>

function loginErrorMessage(err: unknown): string {
  const status = (err as { response?: { status?: number } })?.response?.status
  if (status === 403) return 'Tài khoản đang chờ quản trị viên duyệt'
  return 'Email hoặc mật khẩu không đúng'
}

export function LoginPage() {
  const navigate = useNavigate()
  const { setAuth } = useAuthStore()
  const toast = useToast()
  const [searchParams] = useSearchParams()
  const pending = searchParams.get('pending') === '1'

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const { mutate, isPending } = useMutation({
    mutationFn: authApi.login,
    onSuccess: ({ user, accessToken, refreshToken }) => {
      setAuth(user, accessToken, refreshToken)
      navigate('/projects')
    },
    onError: (err) => toast.error(loginErrorMessage(err)),
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

        {pending && (
          <div className="flex items-start gap-2 rounded-lg border border-accent/30 bg-accent/5 px-3 py-2.5 text-sm">
            <Clock className="w-4 h-4 text-accent mt-0.5 shrink-0" />
            <span className="text-fg-muted">
              Tài khoản của bạn đang chờ quản trị viên duyệt &amp; phân quyền. Vui lòng quay lại sau khi được chấp nhận.
            </span>
          </div>
        )}

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
    </div>
  )
}
