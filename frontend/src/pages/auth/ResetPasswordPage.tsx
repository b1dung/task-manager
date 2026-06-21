import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { authApi } from '@/api/auth'
import { Button, Input } from '@/components/ui'

export function ResetPasswordPage() {
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const [password, setPassword] = useState('')
  const mutation = useMutation({ mutationFn: () => authApi.resetPassword(token, password) })

  return (
    <div className="flex min-h-full items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-5">
        <h1 className="text-2xl font-semibold text-fg">Đặt lại mật khẩu</h1>
        {mutation.isSuccess ? (
          <p className="text-sm text-success">Mật khẩu đã được cập nhật. Tất cả phiên đăng nhập cũ đã bị thu hồi.</p>
        ) : (
          <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); mutation.mutate() }}>
            <Input label="Mật khẩu mới" type="password" minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} required autoComplete="new-password" />
            {mutation.isError && <p className="text-sm text-danger">Liên kết không hợp lệ hoặc đã hết hạn.</p>}
            <Button type="submit" className="w-full" disabled={!token || password.length < 8} loading={mutation.isPending}>Đổi mật khẩu</Button>
          </form>
        )}
        <Link className="block text-center text-sm text-accent hover:underline" to="/login">Đăng nhập</Link>
      </div>
    </div>
  )
}
