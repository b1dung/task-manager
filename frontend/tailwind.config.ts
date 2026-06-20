import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Be Vietnam Pro', 'Geist', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['Geist Mono', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      colors: {
        bg: {
          DEFAULT: 'rgb(var(--color-bg) / <alpha-value>)',
          surface:  'rgb(var(--color-bg-surface)  / <alpha-value>)',
          subtle:   'rgb(var(--color-bg-subtle)   / <alpha-value>)',
          elevated: 'rgb(var(--color-bg-elevated) / <alpha-value>)',
          active:   'rgb(var(--color-bg-active)   / <alpha-value>)',
        },
        border: {
          DEFAULT: 'rgb(var(--color-border)        / <alpha-value>)',
          bright:  'rgb(var(--color-border-bright) / <alpha-value>)',
          subtle:  'rgb(var(--color-border-subtle) / <alpha-value>)',
        },
        fg: {
          DEFAULT: 'rgb(var(--color-fg)        / <alpha-value>)',
          muted:   'rgb(var(--color-fg-muted)   / <alpha-value>)',
          subtle:  'rgb(var(--color-fg-subtle)  / <alpha-value>)',
        },
        accent: {
          DEFAULT: 'rgb(var(--color-accent)        / <alpha-value>)',
          fg:      'rgb(var(--color-accent-fg)     / <alpha-value>)',
          subtle:  'rgb(var(--color-accent-subtle) / <alpha-value>)',
          deep:    'rgb(var(--color-accent-deep)   / <alpha-value>)',
          2:       'rgb(var(--color-accent-2)      / <alpha-value>)',
        },
        success: 'rgb(var(--color-success) / <alpha-value>)',
        warning: 'rgb(var(--color-warning) / <alpha-value>)',
        danger:  'rgb(var(--color-danger)  / <alpha-value>)',
        info:    'rgb(var(--color-info)    / <alpha-value>)',
      },
      maxWidth: {
        'modal-2k': '1400px',
        'modal-fhd': '1200px',
      },
      fontSize: {
        xs: ['13px', { lineHeight: '1.4' }],
      },
      borderRadius: {
        card: '0.75rem',
      },
      boxShadow: {
        card:    '0 1px 2px 0 rgb(0 0 0 / 0.3)',
        popover: '0 8px 30px rgb(0 0 0 / 0.4)',
        sm:      'var(--shadow-sm)',
        md:      'var(--shadow-md)',
        lg:      'var(--shadow-lg)',
      },
    },
  },
  plugins: [],
} satisfies Config
