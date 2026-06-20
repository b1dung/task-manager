import { describe, it, expect, beforeEach } from 'vitest'
import { useAuthStore } from '@/stores/useAuthStore'

const mockUser = {
  id: 'user-1',
  email: 'alice@example.com',
  fullName: 'Alice',
  avatarUrl: null,
  role: 'member',
}

beforeEach(() => {
  useAuthStore.setState({
    user: null,
    accessToken: null,
    refreshToken: null,
    isAuthenticated: false,
  })
})

describe('useAuthStore', () => {
  it('starts unauthenticated', () => {
    const { isAuthenticated, user } = useAuthStore.getState()
    expect(isAuthenticated).toBe(false)
    expect(user).toBeNull()
  })

  it('setAuth authenticates the user', () => {
    useAuthStore.getState().setAuth(mockUser, 'access-token', 'refresh-token')
    const state = useAuthStore.getState()
    expect(state.isAuthenticated).toBe(true)
    expect(state.user).toEqual(mockUser)
    expect(state.accessToken).toBe('access-token')
    expect(state.refreshToken).toBe('refresh-token')
  })

  it('setTokens updates only tokens', () => {
    useAuthStore.getState().setAuth(mockUser, 'old-access', 'old-refresh')
    useAuthStore.getState().setTokens('new-access', 'new-refresh')
    const state = useAuthStore.getState()
    expect(state.accessToken).toBe('new-access')
    expect(state.refreshToken).toBe('new-refresh')
    expect(state.user).toEqual(mockUser)
  })

  it('logout clears all auth state', () => {
    useAuthStore.getState().setAuth(mockUser, 'token', 'refresh')
    useAuthStore.getState().logout()
    const state = useAuthStore.getState()
    expect(state.isAuthenticated).toBe(false)
    expect(state.user).toBeNull()
    expect(state.accessToken).toBeNull()
  })
})
