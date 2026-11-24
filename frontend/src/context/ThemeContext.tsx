import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

export type ThemeMode = 'light' | 'dark' | 'system'
export type ResolvedTheme = 'light' | 'dark'

const KEY = 'hs-theme'
const META_COLOR: Record<ResolvedTheme, string> = { light: '#f5f2ec', dark: '#0b1020' }

const systemTheme = (): ResolvedTheme =>
  window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'

const storedMode = (): ThemeMode => {
  const v = localStorage.getItem(KEY)
  return v === 'light' || v === 'dark' ? v : 'system'
}

interface ThemeState {
  /** What the user picked — 'system' follows the OS setting. */
  mode: ThemeMode
  /** The theme actually on screen. */
  resolved: ResolvedTheme
  setMode: (mode: ThemeMode) => void
  toggle: () => void
}

const ThemeContext = createContext<ThemeState | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(storedMode)
  const [system, setSystem] = useState<ResolvedTheme>(systemTheme)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => setSystem(systemTheme())
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  const resolved: ResolvedTheme = mode === 'system' ? system : mode

  useEffect(() => {
    document.documentElement.classList.toggle('dark', resolved === 'dark')
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', META_COLOR[resolved])
  }, [resolved])

  const setMode = (m: ThemeMode) => {
    localStorage.setItem(KEY, m)
    setModeState(m)
  }

  const value = useMemo<ThemeState>(
    () => ({
      mode,
      resolved,
      setMode,
      toggle: () => setMode(resolved === 'dark' ? 'light' : 'dark'),
    }),
    [mode, resolved],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>')
  return ctx
}
