import { useUIStore, type ToastOptions } from '@/stores/useUIStore'

export function useToast() {
  const addToast = useUIStore((s) => s.addToast)
  const removeToast = useUIStore((s) => s.removeToast)
  return {
    success: (msg: string, options?: ToastOptions) => addToast('success', msg, options),
    error: (msg: string, options?: ToastOptions) => addToast('error', msg, options),
    info: (msg: string, options?: ToastOptions) => addToast('info', msg, options),
    warning: (msg: string, options?: ToastOptions) => addToast('warning', msg, options),
    /** Show an "undo" snackbar (default 10s). Runs `onUndo` if the user clicks it. */
    undo: (msg: string, onUndo: () => void, duration = 10000) =>
      addToast('info', msg, {
        duration,
        action: { label: 'Hoàn tác', onClick: onUndo },
      }),
    dismiss: removeToast,
  }
}
