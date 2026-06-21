import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { authApi } from '@/api/auth'
import { Button, Input } from '@/components/ui'

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const mutation = useMutation({ mutationFn: () => authApi.forgotPassword(email) })

  return (
    <div className="flex min-h-full items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-5">
        <h1 className="text-2xl font-semibold text-fg">Quên mật khẩu</h1>
        {mutation.isSuccess ? (
          <p className="text-sm text-fg-muted">Nếu email tồn tại, hướng dẫn đặt lại mật khẩu đã được gửi.</p>
        ) : (
          <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); mutation.mutate() }}>
            <Input label="Email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" />
            <Button type="submit" className="w-full" loading={mutation.isPending}>Gửi hướng dẫn</Button>
          </form>
        )}
        <Link className="block text-center text-sm text-accent hover:underline" to="/login">Quay lại đăng nhập</Link>
      </div>
    </div>
  )
}
