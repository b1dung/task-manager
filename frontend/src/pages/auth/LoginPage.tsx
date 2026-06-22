import { useMemo, useState } from 'react'
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
import { useTranslation } from 'react-i18next'

type FormData = { email: string; password: string; otp?: string }

function errorStatus(err: unknown): number | undefined {
  return (err as { response?: { status?: number } })?.response?.status
}

const SHOW_TWO_FACTOR = true

export function LoginPage() {
  const { t } = useTranslation()
  const schema = useMemo(() => z.object({
    email: z.string().email(t('auth.invalidEmail')),
    password: z.string().min(6, t('auth.passwordMin6')),
    otp: z.string().regex(/^\d{6}$/, 'Mã 2FA phải có 6 chữ số').optional().or(z.literal('')),
  }), [t])
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
      else toast.error(t('auth.invalidCredentials'))
    },
  })

  return (
    <div className="flex min-h-full items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <div className="mx-auto w-10 h-10 rounded-xl bg-accent flex items-center justify-center text-white font-bold mb-4">
            TB
          </div>
          <h1 className="text-2xl font-semibold text-fg">{t('auth.login')}</h1>
          <p className="mt-1 text-sm text-fg-muted">{t('auth.welcomeBack')}</p>
        </div>

        <form onSubmit={handleSubmit((d) => mutate(d))} className="space-y-4">
          <Input
            {...register('email')}
            label={t('auth.email')}
            type="email"
            placeholder="you@example.com"
            error={errors.email?.message}
            autoComplete="email"
          />
          {SHOW_TWO_FACTOR && (
            <Input
              {...register('otp')}
              label="Mã 2FA (nếu đã bật)"
              inputMode="numeric"
              maxLength={6}
              autoComplete="one-time-code"
              error={errors.otp?.message}
            />
          )}
          <Input
            {...register('password')}
            label={t('auth.password')}
            type="password"
            placeholder="••••••••"
            error={errors.password?.message}
            autoComplete="current-password"
          />
          <Button type="submit" variant="primary" className="w-full" loading={isPending}>
            {t('auth.login')}
          </Button>
          <Link to="/forgot-password" className="block text-right text-xs text-accent hover:underline">
            Quên mật khẩu?
          </Link>
        </form>

        <p className="text-center text-sm text-fg-muted">
          {t('auth.noAccount')}{' '}
          <Link to="/register" className="text-accent hover:underline">
            {t('auth.register')}
          </Link>
        </p>
      </div>

      <Modal open={showPending} onClose={() => setShowPending(false)} title={t('auth.pendingTitle')} size="sm">
        <div className="px-5 py-5 flex flex-col items-center text-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-warning/15 text-warning">
            <Clock className="w-6 h-6" />
          </div>
          <p className="text-sm text-fg">
            {t('auth.pendingMessage')}
          </p>
          <p className="text-xs text-fg-muted">
            {t('auth.pendingHelp')}
          </p>
        </div>
        <div className="px-5 py-4 border-t border-border flex justify-center">
          <Button variant="primary" size="sm" onClick={() => setShowPending(false)}>{t('common.understood')}</Button>
        </div>
      </Modal>
    </div>
  )
}
