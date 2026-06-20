import { NotificationsDropdown } from './NotificationsDropdown'
import { UserAccountMenu } from './UserAccountMenu'

export function Topbar() {
  return (
    <header className="h-14 flex items-center gap-3 px-4 border-b border-border bg-bg-surface shrink-0">
      <div className="flex-1" />

      <NotificationsDropdown />
      <UserAccountMenu />
    </header>
  )
}
