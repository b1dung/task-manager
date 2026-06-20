import { CheckCircle, XCircle, AlertCircle, Info, X } from 'lucide-react'
import { useUIStore } from '@/stores/useUIStore'
import { cn } from '@/lib/utils'

const icons = {
  success: <CheckCircle className="w-4 h-4 text-success shrink-0" />,
  error: <XCircle className="w-4 h-4 text-danger shrink-0" />,
  warning: <AlertCircle className="w-4 h-4 text-warning shrink-0" />,
  info: <Info className="w-4 h-4 text-info shrink-0" />,
}

const borderCls = {
  success: 'border-success/30',
  error: 'border-danger/30',
  warning: 'border-warning/30',
  info: 'border-info/30',
}

export function ToastContainer() {
  const { toasts, removeToast } = useUIStore()
  if (!toasts.length) return null
  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm w-full">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cn(
            'flex items-start gap-3 rounded-lg border bg-bg-elevated px-4 py-3 shadow-popover animate-in slide-in-from-right-4',
            borderCls[t.type],
          )}
        >
          {icons[t.type]}
          <p className="flex-1 text-sm text-fg">{t.message}</p>
          {t.action && (
            <button
              onClick={() => { t.action!.onClick(); removeToast(t.id) }}
              className="shrink-0 text-sm font-semibold text-accent hover:underline"
            >
              {t.action.label}
            </button>
          )}
          <button
            onClick={() => removeToast(t.id)}
            className="text-fg-subtle hover:text-fg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  )
}
