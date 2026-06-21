import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useNavigate, Link, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import { CheckCircle2, Clock, Mail } from 'lucide-react'
import { authApi } from '@/api/auth'
import { invitesApi } from '@/api/invites'
import { useAuthStore } from '@/stores/useAuthStore'
import { Button, Input, Spinner } from '@/components/ui'
import { useToast } from '@/hooks/useToast'
import { useTranslation } from 'react-i18next'

type FormData = { fullName: string; email: string; password: string }

export function RegisterPage() {
  const { t } = useTranslation()
  const schema = useMemo(() => z.object({
    fullName: z.string().min(2, t('auth.nameMin2')),
    email: z.string().email(t('auth.invalidEmail')),
    password: z.string().min(8, t('auth.passwordMin8')),
  }), [t])
  const navigate = useNavigate()
  const { setAuth } = useAuthStore()
  const toast = useToast()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') ?? undefined
  const [submitted, setSubmitted] = useState(false)

  // When an invite token is present, validate it and prefill the (locked) email.
  const {
    data: invite,
    isLoading: validating,
    isError: inviteInvalid,
  } = useQuery({
    queryKey: ['invite', token],
    queryFn: () => invitesApi.validate(token!),
    enabled: !!token,
    retry: false,
  })

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    values: invite ? { fullName: '', email: invite.email, password: '' } : undefined,
  })

  const { mutate, isPending } = useMutation({
    mutationFn: (d: FormData) =>
      authApi.register(
        token
          ? { token, password: d.password, fullName: d.fullName }
          : { email: d.email, password: d.password, fullName: d.fullName },
      ),
    onSuccess: (res) => {
      if (res.status === 'active') {
        setAuth(res.user, res.accessToken, '')
        navigate('/projects')
      } else {
        setSubmitted(true)
      }
    },
    onError: () => toast.error(t('auth.registerFailed')),
  })

  // ── Invite link is invalid/expired ──────────────────────────────────────────
  if (token && inviteInvalid) {
    return (
      <CenteredCard>
        <div className="text-center space-y-3">
          <Mail className="mx-auto w-10 h-10 text-danger" />
          <h1 className="text-xl font-semibold text-fg">{t('auth.invalidInvite')}</h1>
          <p className="text-sm text-fg-muted">
            {t('auth.invalidInviteMessage')}
          </p>
          <Link to="/login" className="inline-block text-accent hover:underline text-sm">{t('auth.backToLogin')}</Link>
        </div>
      </CenteredCard>
    )
  }

  // ── Public registration submitted → pending approval ─────────────────────────
  if (submitted) {
    return (
      <CenteredCard>
        <div className="text-center space-y-3">
          <Clock className="mx-auto w-10 h-10 text-accent" />
          <h1 className="text-xl font-semibold text-fg">{t('auth.pendingApproval')}</h1>
          <p className="text-sm text-fg-muted">
            {t('auth.pendingMessage')} {t('auth.pendingHelp')}
          </p>
          <Link to="/login" className="inline-block text-accent hover:underline text-sm">{t('auth.backToLogin')}</Link>
        </div>
      </CenteredCard>
    )
  }

  if (token && validating) {
    return <CenteredCard><div className="flex justify-center py-8"><Spinner /></div></CenteredCard>
  }

  return (
    <CenteredCard>
      <div className="text-center">
        <div className="mx-auto w-10 h-10 rounded-xl bg-accent flex items-center justify-center text-white font-bold mb-4">
          TB
        </div>
        <h1 className="text-2xl font-semibold text-fg">{token ? t('auth.completeInvite') : t('auth.register')}</h1>
        <p className="mt-1 text-sm text-fg-muted">
          {token ? t('auth.setPassword') : t('auth.createAccount')}
        </p>
      </div>

      {token && invite && (
        <div className="flex items-start gap-2 rounded-lg border border-accent/30 bg-accent/5 px-3 py-2.5 text-sm">
          <CheckCircle2 className="w-4 h-4 text-accent mt-0.5 shrink-0" />
          <span className="text-fg-muted">
            {t('auth.invitedAs', { role: invite.roleName ?? t('common.member') })}
          </span>
        </div>
      )}

      <form onSubmit={handleSubmit((d) => mutate(d))} className="space-y-4">
        <Input
          {...register('fullName')}
          label={t('auth.fullName')}
          placeholder={t('users.fullNamePlaceholder')}
          error={errors.fullName?.message}
        />
        <Input
          {...register('email')}
          label={t('auth.email')}
          type="email"
          placeholder="you@example.com"
          error={errors.email?.message}
          disabled={!!token}
          readOnly={!!token}
        />
        <Input
          {...register('password')}
          label={t('auth.password')}
          type="password"
          placeholder="••••••••"
          error={errors.password?.message}
        />
        <Button type="submit" variant="primary" className="w-full" loading={isPending}>
          {token ? t('auth.activate') : t('auth.register')}
        </Button>
      </form>

      {!token && (
        <p className="text-center text-xs text-fg-subtle">
          {t('auth.approvalNotice')}
        </p>
      )}

      <p className="text-center text-sm text-fg-muted">
        {t('auth.hasAccount')}{' '}
        <Link to="/login" className="text-accent hover:underline">
          {t('auth.login')}
        </Link>
      </p>
    </CenteredCard>
  )
}

function CenteredCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">{children}</div>
    </div>
  )
}
