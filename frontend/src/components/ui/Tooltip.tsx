import { useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface TooltipProps {
  content: string
  children: ReactNode
  side?: 'top' | 'bottom' | 'left' | 'right'
  disabled?: boolean
}

export function Tooltip({ content, children, side = 'top', disabled = false }: TooltipProps) {
  const [visible, setVisible] = useState(false)
  if (disabled) return <>{children}</>

  const sideCls = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-1.5',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-1.5',
    left: 'right-full top-1/2 -translate-y-1/2 mr-1.5',
    right: 'left-full top-1/2 -translate-y-1/2 ml-1.5',
  }

  return (
    <div
      className="relative inline-flex"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      {children}
      {visible && (
        <span
          className={cn(
            'absolute z-50 px-2 py-1 rounded-md text-xs font-medium whitespace-nowrap pointer-events-none',
            'bg-bg-elevated border border-border text-fg shadow-popover',
            sideCls[side],
          )}
        >
          {content}
        </span>
      )}
    </div>
  )
}
