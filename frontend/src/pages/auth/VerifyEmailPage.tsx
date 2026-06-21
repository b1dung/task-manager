import { useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { authApi } from '@/api/auth'

export function VerifyEmailPage() {
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const mutation = useMutation({ mutationFn: () => authApi.verifyEmail(token) })

  useEffect(() => {
    if (token) mutation.mutate()
    // The token is immutable for this mounted route.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  return (
    <div className="flex min-h-full items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-4 text-center">
        <h1 className="text-2xl font-semibold text-fg">Xác thực email</h1>
        <p className="text-sm text-fg-muted">
          {mutation.isPending && 'Đang xác thực…'}
          {mutation.isSuccess && 'Email đã được xác thực.'}
          {(mutation.isError || !token) && 'Liên kết không hợp lệ hoặc đã hết hạn.'}
        </p>
        <Link className="text-sm text-accent hover:underline" to="/login">Đăng nhập</Link>
      </div>
    </div>
  )
}
