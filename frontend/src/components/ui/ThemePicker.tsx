import { useState, useRef, useEffect } from 'react'
import { Palette, Check } from 'lucide-react'
import { THEMES, type ThemeKey } from '@/lib/themes'
import { useUIStore } from '@/stores/useUIStore'
import { cn } from '@/lib/utils'
import { Tooltip } from './Tooltip'

export function ThemePicker() {
  const { theme, setTheme } = useUIStore()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div ref={ref} className="relative">
      <Tooltip content="Chọn theme">
        <button
          onClick={() => setOpen((v) => !v)}
          className={cn(
            'h-8 w-8 flex items-center justify-center rounded-lg transition-colors',
            open ? 'bg-bg-active text-accent' : 'text-fg-muted hover:text-fg hover:bg-bg-subtle',
          )}
        >
          <Palette className="w-4 h-4" />
        </button>
      </Tooltip>

      {open && (
        <div className="absolute right-0 top-10 z-50 w-52 rounded-xl border border-border bg-bg-surface shadow-app-lg p-2 space-y-0.5">
          <p className="text-[11px] font-medium text-fg-subtle uppercase tracking-wide px-2 pb-1">
            Theme
          </p>
          {THEMES.map((t) => (
            <button
              key={t.key}
              onClick={() => { setTheme(t.key as ThemeKey); setOpen(false) }}
              className={cn(
                'w-full flex items-center gap-3 px-2 py-2 rounded-lg text-sm transition-colors',
                theme === t.key
                  ? 'bg-bg-active text-fg font-medium'
                  : 'text-fg-muted hover:text-fg hover:bg-bg-subtle',
              )}
            >
              {/* Color swatch — gradient circle */}
              <span
                className="w-5 h-5 rounded-full shrink-0 ring-1 ring-border"
                style={{ background: `linear-gradient(135deg, ${t.primary} 0%, ${t.secondary} 100%)` }}
              />
              <span className="flex-1 text-left">{t.label}</span>
              {theme === t.key && <Check className="w-3.5 h-3.5 text-accent shrink-0" />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
