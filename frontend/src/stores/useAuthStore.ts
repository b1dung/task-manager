import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { queryClient } from '@/lib/queryClient'

export interface AuthUser {
  id: string
  email: string
  fullName: string
  avatarUrl: string | null
  role: string
  /** Optional for sessions persisted before user preferences were introduced. */
  language?: import('@/i18n').AppLanguage
  appearance?: 'light' | 'midnight' | 'mint'
  timezone?: import('@/lib/timezones').UserTimezone
  twoFactorEnabled?: boolean
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
    {
      name: 'auth-storage',
      version: 1,
      migrate: (persisted, version) => {
        const state = persisted as { user?: AuthUser | null; isAuthenticated?: boolean }
        if (version < 1 && state.user?.language === 'vi') {
          return { ...state, user: { ...state.user, language: 'en' as const } }
        }
        return state
      },
      // Persist the tokens too — otherwise a full page reload restores
      // `isAuthenticated: true` but a null accessToken, so the first API call
      // 401s → refresh → logout → bounce to /login.
      partialize: (s) => ({
        user: s.user,
        accessToken: s.accessToken,
        refreshToken: s.refreshToken,
        isAuthenticated: s.isAuthenticated,
      }),
    },
  ),
)
