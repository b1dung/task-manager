import { useEffect, useState, type ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Modal } from './Modal'
import { Button } from './Button'

interface ConfirmDialogProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title?: string
  message?: ReactNode
  /** Extra warning block shown above the actions (e.g. "this has N tasks"). */
  warning?: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
  loading?: boolean
  /** When set, the user must type this exact text to enable the confirm button. */
  requireText?: string
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title = 'Xác nhận',
  message,
  warning,
  confirmLabel = 'Xóa',
  cancelLabel = 'Hủy',
  danger = true,
  loading = false,
  requireText,
}: ConfirmDialogProps) {
  const [typed, setTyped] = useState('')

  // Reset the typed confirmation whenever the dialog (re)opens.
  useEffect(() => {
    if (open) setTyped('')
  }, [open])

  const matches = !requireText || typed.trim() === requireText
  const canConfirm = matches && !loading

  return (
    <Modal open={open} onClose={() => !loading && onClose()} title={title} size="sm">
      <div className="px-5 py-4 space-y-3">
        {message && <div className="text-sm text-fg">{message}</div>}
        {warning}
        {requireText && (
          <div className="space-y-1.5">
            <label className="text-xs text-fg-muted">
              Nhập <span className="font-mono font-semibold text-fg">{requireText}</span> để xác nhận
            </label>
            <input
              autoFocus
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && canConfirm) onConfirm() }}
              placeholder={requireText}
              className="w-full rounded-lg border border-border bg-bg-elevated px-3 py-2 text-sm text-fg placeholder:text-fg-subtle focus:outline-none focus:ring-2 focus:ring-danger"
            />
          </div>
        )}
      </div>
      <div className="px-5 py-4 border-t border-border flex justify-end gap-3">
        <Button variant="ghost" size="sm" disabled={loading} onClick={onClose}>{cancelLabel}</Button>
        <Button
          variant={danger ? 'danger' : 'primary'}
          size="sm"
          loading={loading}
          disabled={!canConfirm}
          onClick={onConfirm}
        >
          {danger && <AlertTriangle className="w-4 h-4" />}
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  )
}
