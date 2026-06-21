import { cn } from '@/lib/utils'
import { useTranslation } from 'react-i18next'

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'accent'

const variantCls: Record<BadgeVariant, string> = {
  default: 'bg-bg-subtle text-fg-muted border border-border',
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/10 text-warning',
  danger:  'bg-danger/10  text-danger',
  info:    'bg-info/10    text-info',
  accent:  'bg-bg-active  text-accent',
}

interface BadgeProps {
  children: React.ReactNode
  variant?: BadgeVariant
  className?: string
  dot?: boolean
}

export function Badge({ children, variant = 'default', className, dot }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-xs font-medium',
        variantCls[variant],
        className,
      )}
    >
      {dot && (
        <span className={cn('w-1.5 h-1.5 rounded-full bg-current')} />
      )}
      {children}
    </span>
  )
}

export function PriorityBadge({ priority }: { priority: string }) {
  const { t } = useTranslation()
  const map: Record<string, { labelKey: string; variant: BadgeVariant }> = {
    urgent: { labelKey: 'priority.urgent', variant: 'danger' },
    high: { labelKey: 'priority.high', variant: 'warning' },
    medium: { labelKey: 'priority.medium', variant: 'info' },
    low: { labelKey: 'priority.low', variant: 'default' },
  }
  const item = map[priority]
  return <Badge variant={item?.variant ?? 'default'} dot>{item ? t(item.labelKey) : priority}</Badge>
}

export function TypeBadge({ type }: { type: string }) {
  const { t } = useTranslation()
  const map: Record<string, { labelKey: string; variant: BadgeVariant }> = {
    bug: { labelKey: 'taskType.bug', variant: 'danger' },
    feature: { labelKey: 'taskType.feature', variant: 'success' },
    task: { labelKey: 'taskType.task', variant: 'default' },
    story: { labelKey: 'taskType.story', variant: 'accent' },
    epic: { labelKey: 'taskType.epic', variant: 'info' },
  }
  const item = map[type]
  return <Badge variant={item?.variant ?? 'default'}>{item ? t(item.labelKey) : type}</Badge>
}

export function StatusBadge({ status }: { status: string }) {
  const { t } = useTranslation()
  const map: Record<string, { labelKey: string; variant: BadgeVariant }> = {
    todo: { labelKey: 'status.todo', variant: 'default' },
    in_progress: { labelKey: 'status.in_progress', variant: 'info' },
    in_review: { labelKey: 'status.in_review', variant: 'warning' },
    done: { labelKey: 'status.done', variant: 'success' },
  }
  const item = map[status]
  return <Badge variant={item?.variant ?? 'default'}>{item ? t(item.labelKey) : status}</Badge>
}
