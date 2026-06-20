import { useUIStore } from '@/stores/useUIStore'

export function useToast() {
  const addToast = useUIStore((s) => s.addToast)
  return {
    success: (msg: string) => addToast('success', msg),
    error: (msg: string) => addToast('error', msg),
    info: (msg: string) => addToast('info', msg),
    warning: (msg: string) => addToast('warning', msg),
  }
}
