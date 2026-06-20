import { cn } from '@/lib/utils'

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
  const map: Record<string, { label: string; variant: BadgeVariant }> = {
    urgent: { label: 'Urgent', variant: 'danger' },
    high: { label: 'High', variant: 'warning' },
    medium: { label: 'Medium', variant: 'info' },
    low: { label: 'Low', variant: 'default' },
  }
  const { label, variant } = map[priority] ?? { label: priority, variant: 'default' }
  return <Badge variant={variant} dot>{label}</Badge>
}

export function TypeBadge({ type }: { type: string }) {
  const map: Record<string, { label: string; variant: BadgeVariant }> = {
    bug: { label: 'Bug', variant: 'danger' },
    feature: { label: 'Feature', variant: 'success' },
    task: { label: 'Task', variant: 'default' },
    story: { label: 'Story', variant: 'accent' },
    epic: { label: 'Epic', variant: 'info' },
  }
  const { label, variant } = map[type] ?? { label: type, variant: 'default' }
  return <Badge variant={variant}>{label}</Badge>
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; variant: BadgeVariant }> = {
    todo: { label: 'Todo', variant: 'default' },
    in_progress: { label: 'In Progress', variant: 'info' },
    in_review: { label: 'In Review', variant: 'warning' },
    done: { label: 'Done', variant: 'success' },
  }
  const { label, variant } = map[status] ?? { label: status, variant: 'default' }
  return <Badge variant={variant}>{label}</Badge>
}
