import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Bell, BellOff, CheckCheck } from 'lucide-react'
import { notificationsApi } from '@/api/notifications'
import { Button, EmptyState, Skeleton } from '@/components/ui'
import { formatRelative } from '@/lib/utils'
import { cn } from '@/lib/utils'

type Filter = 'all' | 'unread'

export function NotificationsPage() {
  const qc = useQueryClient()
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

  return (
    <div className="flex flex-col h-full overflow-hidden max-w-2xl mx-auto w-full">
      <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
        <h1 className="text-base font-semibold text-fg">Thông báo</h1>
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
                {f === 'all' ? 'Tất cả' : 'Chưa đọc'}
              </button>
            ))}
          </div>
          <Button variant="ghost" size="sm" onClick={() => markAll()}>
            <CheckCheck className="w-4 h-4" /> Đọc tất cả
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
            title="Không có thông báo nào"
          />
        ) : (
          <div className="divide-y divide-border">
            {notifications.map((n) => (
              <div
                key={n.id}
                onClick={() => !n.readAt && markRead(n.id)}
                className={cn(
                  'flex items-start gap-3 px-6 py-4 transition-colors cursor-pointer hover:bg-bg-elevated',
                  !n.readAt && 'bg-accent/5',
                )}
              >
                <div className={cn('w-2 h-2 rounded-full mt-1.5 shrink-0', !n.readAt ? 'bg-accent' : 'bg-transparent')} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-fg">{n.message}</p>
                  <p className="text-xs text-fg-subtle mt-0.5">{formatRelative(n.createdAt)}</p>
                </div>
                <Bell className="w-4 h-4 text-fg-subtle shrink-0 mt-0.5" />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
