import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { type ThemeKey, applyTheme } from '@/lib/themes'

export interface ToastAction {
  label: string
  onClick: () => void
}

interface Toast {
  id: string
  type: 'success' | 'error' | 'info' | 'warning'
  message: string
  action?: ToastAction
}

export interface ToastOptions {
  duration?: number
  action?: ToastAction
}

interface UIState {
  theme: ThemeKey
  sidebarCollapsed: boolean
  toasts: Toast[]
  activeProjectId: string | null
  setTheme: (theme: ThemeKey) => void
  toggleTheme: () => void
  toggleSidebar: () => void
  setActiveProject: (id: string | null) => void
  addToast: (type: Toast['type'], message: string, options?: ToastOptions) => void
  removeToast: (id: string) => void
}

export const useUIStore = create<UIState>()(
  persist(
    (set, get) => ({
      theme: 'light',
      sidebarCollapsed: false,
      toasts: [],
      activeProjectId: null,

      setTheme: (theme) => {
        applyTheme(theme)
        set({ theme })
      },

      toggleTheme: () => {
        const next = get().theme === 'midnight' ? 'light' : 'midnight'
        applyTheme(next)
        set({ theme: next })
      },

      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setActiveProject: (id) => set({ activeProjectId: id }),

      addToast: (type, message, options) =>
        set((s) => {
          const id = Math.random().toString(36).slice(2)
          setTimeout(() => get().removeToast(id), options?.duration ?? 4000)
          return { toasts: [...s.toasts, { id, type, message, action: options?.action }] }
        }),
      removeToast: (id) =>
        set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
    }),
    {
      name: 'ui-storage',
      partialize: (s) => ({ theme: s.theme, sidebarCollapsed: s.sidebarCollapsed, activeProjectId: s.activeProjectId }),
    },
  ),
)
