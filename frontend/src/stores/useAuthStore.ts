import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { queryClient } from '@/lib/queryClient'

export interface AuthUser {
  id: string
  email: string
  fullName: string
  avatarUrl: string | null
  role: string
}

interface AuthState {
  user: AuthUser | null
  accessToken: string | null
  refreshToken: string | null
  isAuthenticated: boolean
  setAuth: (user: AuthUser, accessToken: string, refreshToken: string) => void
  setTokens: (accessToken: string, refreshToken: string) => void
  setUser: (user: AuthUser) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      setAuth: (user, accessToken, refreshToken) =>
        set({ user, accessToken, refreshToken, isAuthenticated: true }),
      setTokens: (accessToken, refreshToken) =>
        set({ accessToken, refreshToken }),
      setUser: (user) => set({ user }),
      logout: () => {
        // Wipe all cached queries so the next user never sees the previous
        // user's permissions, projects, notifications, etc.
        queryClient.clear()
        set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false })
      },
    }),
    { name: 'auth-storage', partialize: (s) => ({ user: s.user, isAuthenticated: s.isAuthenticated }) },
  ),
)
