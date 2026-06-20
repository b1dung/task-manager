import { useNavigate } from 'react-router-dom'
import { LogOut, ChevronDown } from 'lucide-react'
import { useAuthStore } from '@/stores/useAuthStore'
import { authApi } from '@/api/auth'
import { Avatar, Dropdown, ThemePicker } from '@/components/ui'
import { NotificationsDropdown } from './NotificationsDropdown'

export function Topbar() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()

  const handleLogout = async () => {
    try { await authApi.logout() } catch { /* local logout still proceeds */ }
    logout()
    navigate('/login')
  }

  return (
    <header className="h-14 flex items-center gap-3 px-4 border-b border-border bg-bg-surface shrink-0">
      <div className="flex-1" />

      <ThemePicker />

      <NotificationsDropdown />

      {user && (
        <Dropdown
          align="right"
          trigger={
            <button className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-bg-elevated transition-colors">
              <Avatar name={user.fullName} avatarUrl={user.avatarUrl} size="sm" />
              <span className="text-sm text-fg hidden sm:block">{user.fullName}</span>
              <ChevronDown className="w-3 h-3 text-fg-subtle hidden sm:block" />
            </button>
          }
          items={[
            { label: 'Logout', icon: <LogOut className="w-4 h-4" />, onClick: handleLogout, danger: true },
          ]}
        />
      )}
    </header>
  )
}
