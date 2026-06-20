import { cn } from '@/lib/utils'

export function Spinner({ className, size = 'md' }: { className?: string; size?: 'sm' | 'md' | 'lg' }) {
  const sizeCls = { sm: 'w-4 h-4 border-2', md: 'w-6 h-6 border-2', lg: 'w-8 h-8 border-[3px]' }
  return (
    <span
      className={cn(
        'inline-block rounded-full border-accent border-t-transparent animate-spin',
        sizeCls[size],
        className,
      )}
    />
  )
}

export function PageSpinner() {
  return (
    <div className="flex h-full items-center justify-center">
      <Spinner size="lg" />
    </div>
  )
}
