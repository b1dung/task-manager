import { cn } from '@/lib/utils'

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn('animate-pulse rounded-md bg-bg-elevated', className)}
    />
  )
}

export function TaskCardSkeleton() {
  return (
    <div className="rounded-card border border-border bg-bg-elevated p-3 space-y-2">
      <Skeleton className="h-4 w-4/5" />
      <Skeleton className="h-3 w-3/5" />
      <div className="flex gap-1 pt-1">
        <Skeleton className="h-5 w-12 rounded-md" />
        <Skeleton className="h-5 w-14 rounded-md" />
      </div>
      <div className="flex justify-between pt-1">
        <Skeleton className="h-5 w-5 rounded-full" />
        <Skeleton className="h-3 w-16" />
      </div>
    </div>
  )
}
