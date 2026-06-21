import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Bell, BellOff, CheckCheck } from 'lucide-react'
import { notificationsApi, notificationLink, type Notification } from '@/api/notifications'
import { Avatar, Button, EmptyState, Skeleton } from '@/components/ui'
import { formatRelative, cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/useAuthStore'
import { DEFAULT_TIMEZONE, formatZonedDateTime } from '@/lib/timezones'
import { useTranslation } from 'react-i18next'

type Filter = 'all' | 'unread'

export function NotificationsPage() {
  const { t } = useTranslation()
  const timezone = useAuthStore((state) => state.user?.timezone ?? DEFAULT_TIMEZONE)
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [filter, setFilter] = useState<Filter>('all')

  const { data, isLoading } = useQuery({
    queryKey: ['notifications', filter],
    queryFn: () => notificationsApi.list({ unread: filter === 'unread' || undefined }),
  })
  const notifications = data?.data ?? []

  const { mutate: markRead } = useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  })

  const { mutate: markAll } = useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  })

  const handleClick = (n: Notification) => {
    if (!n.readAt) markRead(n.id)
    const link = notificationLink(n)
    if (link) navigate(link)
  }

  return (
    <div className="flex flex-col h-full overflow-hidden max-w-2xl mx-auto w-full">
      <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
        <h1 className="text-base font-semibold text-fg">{t('notifications.title')}</h1>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-border overflow-hidden text-sm">
            {(['all', 'unread'] as Filter[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  'px-3 py-1.5 text-xs transition-colors',
                  filter === f ? 'bg-accent/15 text-accent' : 'text-fg-muted hover:text-fg',
                )}
              >
                {f === 'all' ? t('common.all') : t('notifications.unread')}
              </button>
            ))}
          </div>
          <Button variant="ghost" size="sm" onClick={() => markAll()}>
            <CheckCheck className="w-4 h-4" /> {t('notifications.markAll')}
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {isLoading ? (
          <div className="p-4 space-y-2">
            {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16 rounded-lg" />)}
          </div>
        ) : notifications.length === 0 ? (
          <EmptyState
            icon={<BellOff className="w-12 h-12" />}
            title={t('notifications.empty')}
          />
        ) : (
          <div className="divide-y divide-border">
            {notifications.map((n) => (
              <button
                key={n.id}
                onClick={() => handleClick(n)}
                className={cn(
                  'flex w-full items-start gap-3 px-6 py-4 text-left transition-colors hover:bg-bg-elevated',
                  !n.readAt && 'bg-accent/5',
                )}
              >
                {n.actor ? (
                  <Avatar name={n.actor.fullName} avatarUrl={n.actor.avatarUrl} size="sm" className="shrink-0" />
                ) : (
                  <span className="flex items-center justify-center w-7 h-7 rounded-full bg-bg-subtle text-fg-subtle shrink-0">
                    <Bell className="w-3.5 h-3.5" />
                  </span>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-fg">
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
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
