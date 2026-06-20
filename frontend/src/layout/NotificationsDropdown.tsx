import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Bell,
  BellOff,
  CheckCheck,
  AtSign,
  MessageSquare,
  UserPlus,
  MoveRight,
  PencilLine,
  CalendarClock,
  Download,
  FilePlus2,
  Timer,
} from 'lucide-react'
import { notificationsApi, notificationLink, type Notification } from '@/api/notifications'
import { Avatar, Button, Skeleton } from '@/components/ui'
import { formatRelative, cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/useAuthStore'
import { DEFAULT_TIMEZONE, formatZonedDateTime } from '@/lib/timezones'

const TYPE_ICON: Record<string, ReactNode> = {
  task_created: <FilePlus2 className="w-3.5 h-3.5" />,
  task_assigned: <UserPlus className="w-3.5 h-3.5" />,
  task_updated: <PencilLine className="w-3.5 h-3.5" />,
  task_moved: <MoveRight className="w-3.5 h-3.5" />,
  time_logged: <Timer className="w-3.5 h-3.5" />,
  comment_added: <MessageSquare className="w-3.5 h-3.5" />,
  mention: <AtSign className="w-3.5 h-3.5" />,
  due_date_reminder: <CalendarClock className="w-3.5 h-3.5" />,
  export_ready: <Download className="w-3.5 h-3.5" />,
}

export function NotificationsDropdown() {
  const timezone = useAuthStore((state) => state.user?.timezone ?? DEFAULT_TIMEZONE)
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Unread badge — polled even while the dropdown is closed.
  const { data: unreadData } = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: () => notificationsApi.unreadCount(),
    refetchInterval: 30000,
  })
  const unread = unreadData?.count ?? 0

  // Recent list — only fetched while the dropdown is open.
  const { data, isLoading } = useQuery({
    queryKey: ['notifications', 'recent'],
    queryFn: () => notificationsApi.list({ page: 1 }),
    enabled: open,
  })
  const notifications = (data?.data ?? []).slice(0, 8)

  const { mutate: markRead } = useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  })

  const { mutate: markAll } = useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  })

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const handleClick = (n: Notification) => {
    if (!n.readAt) markRead(n.id)
    const link = notificationLink(n)
    setOpen(false)
    if (link) navigate(link)
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative inline-flex items-center justify-center w-9 h-9 rounded-lg text-fg-muted hover:bg-bg-elevated hover:text-fg transition-colors"
        aria-label="Thông báo"
      >
        <Bell className="w-4 h-4" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 rounded-full bg-danger text-white text-[10px] font-bold flex items-center justify-center px-1">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-[360px] max-w-[calc(100vw-2rem)] rounded-xl border border-border bg-bg-elevated shadow-popover overflow-hidden z-50">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <span className="text-sm font-semibold text-fg">
              Thông báo{unread > 0 && <span className="text-fg-subtle font-normal"> · {unread} mới</span>}
            </span>
            {unread > 0 && (
              <button
                onClick={() => markAll()}
                className="flex items-center gap-1 text-xs text-accent hover:underline"
              >
                <CheckCheck className="w-3.5 h-3.5" /> Đọc tất cả
              </button>
            )}
          </div>

          <div className="max-h-[420px] overflow-y-auto scrollbar-thin">
            {isLoading ? (
              <div className="p-3 space-y-2">
                {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-14 rounded-lg" />)}
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-10 text-fg-subtle">
                <BellOff className="w-8 h-8" />
                <span className="text-sm">Không có thông báo nào</span>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {notifications.map((n) => {
                  const linkable = !!notificationLink(n)
                  return (
                    <button
                      key={n.id}
                      onClick={() => handleClick(n)}
                      className={cn(
                        'flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-bg-surface',
                        !n.readAt && 'bg-accent/5',
                      )}
                    >
                      <div className="relative shrink-0">
                        {n.actor ? (
                          <Avatar name={n.actor.fullName} avatarUrl={n.actor.avatarUrl} size="sm" />
                        ) : (
                          <span className="flex items-center justify-center w-7 h-7 rounded-full bg-bg-surface text-fg-subtle">
                            {TYPE_ICON[n.type] ?? <Bell className="w-3.5 h-3.5" />}
                          </span>
                        )}
                        <span className="absolute -bottom-0.5 -right-0.5 flex items-center justify-center w-4 h-4 rounded-full bg-bg-elevated text-accent">
                          {TYPE_ICON[n.type] ?? <Bell className="w-2.5 h-2.5" />}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-fg line-clamp-2">
                          {n.actor && <span className="font-medium">{n.actor.fullName} </span>}
                          {n.message}
                        </p>
                        {n.context?.taskId && (
                          <p className="text-xs text-fg-subtle mt-0.5 truncate">
                            {n.context.projectName && <span>{n.context.projectName} · </span>}
                            {n.context.taskTitle}
                          </p>
                        )}
                        <p className="text-xs text-fg-subtle mt-0.5" title={formatRelative(n.createdAt, timezone)}>
                          {formatZonedDateTime(n.createdAt, timezone)}
                        </p>
                      </div>
                      {!n.readAt && <span className="w-2 h-2 rounded-full bg-accent mt-1.5 shrink-0" />}
                      {!linkable && <span className="sr-only">không liên kết</span>}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          <div className="border-t border-border p-2">
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-center"
              onClick={() => {
                setOpen(false)
                navigate('./notifications')
              }}
            >
              Xem tất cả thông báo
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
