import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from '@/App'

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

describe('App', () => {
  it('redirects unauthenticated users to login page', () => {
    render(<App />, { wrapper })
    // Unauthenticated → redirects to /login which shows the login form
    expect(screen.getByRole('button', { name: /đăng nhập/i })).toBeInTheDocument()
  })
})
