export type ThemeKey = 'midnight' | 'mint' | 'light'

export interface ThemeMeta {
  key: ThemeKey
  label: string
  primary: string
  secondary: string
  dark: boolean
}

export const THEMES: ThemeMeta[] = [
  {
    key: 'midnight',
    label: 'Midnight',
    primary: '#4f8ef7',
    secondary: '#6da8ff',
    dark: true,
  },
  {
    key: 'mint',
    label: 'Mint',
    primary: '#16b8a6',
    secondary: '#3dd6c0',
    dark: false,
  },
  {
    key: 'light',
    label: 'Light',
    primary: '#4f8ef7',
    secondary: '#6da8ff',
    dark: false,
  },
]

export function applyTheme(key: ThemeKey) {
  const html = document.documentElement
  html.classList.remove('dark', 'light', 'midnight', 'mint')
  html.classList.add(key)
  if (THEMES.find((t) => t.key === key)?.dark) {
    html.classList.add('dark')
  }
}
