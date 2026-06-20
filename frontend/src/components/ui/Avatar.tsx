import { cn, getInitials } from '@/lib/utils'

const COLORS = [
  'bg-violet-500', 'bg-blue-500', 'bg-emerald-500',
  'bg-rose-500', 'bg-amber-500', 'bg-cyan-500', 'bg-pink-500',
]

function colorFromName(name: string) {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return COLORS[Math.abs(hash) % COLORS.length]
}

interface AvatarProps {
  name: string
  avatarUrl?: string | null
  size?: 'xs' | 'sm' | 'md' | 'lg'
  className?: string
}

const sizeCls = { xs: 'w-5 h-5 text-[10px]', sm: 'w-7 h-7 text-xs', md: 'w-8 h-8 text-sm', lg: 'w-10 h-10 text-base' }

export function Avatar({ name, avatarUrl, size = 'sm', className }: AvatarProps) {
  return avatarUrl ? (
    <img
      src={avatarUrl}
      alt={name}
      title={name}
      className={cn('rounded-full object-cover ring-1 ring-border', sizeCls[size], className)}
    />
  ) : (
    <span
      title={name}
      className={cn(
        'rounded-full inline-flex items-center justify-center font-semibold text-white ring-1 ring-white/20',
        colorFromName(name),
        sizeCls[size],
        className,
      )}
    >
      {getInitials(name)}
    </span>
  )
}

export function AvatarGroup({ users, max = 3 }: { users: Array<{ name: string; avatarUrl?: string | null }>; max?: number }) {
  const visible = users.slice(0, max)
  const rest = users.length - max
  return (
    <div className="flex -space-x-1.5">
      {visible.map((u, i) => (
        <Avatar key={i} name={u.name} avatarUrl={u.avatarUrl} size="xs" className="ring-2 ring-bg" />
      ))}
      {rest > 0 && (
        <span className="w-5 h-5 rounded-full bg-bg-elevated border border-border text-[10px] text-fg-muted inline-flex items-center justify-center ring-2 ring-bg">
          +{rest}
        </span>
      )}
    </div>
  )
}
