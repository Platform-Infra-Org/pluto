import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

// Theme system: light/dark/system mode + a named accent scheme. Both persist to
// localStorage and are applied as data-theme (resolved to light|dark) and
// data-accent on <html>, which the CSS variable blocks in index.css key off.

export type Mode = 'light' | 'dark' | 'system'
export type Accent = 'indigo' | 'emerald' | 'rose' | 'amber' | 'violet'

export const ACCENTS: readonly Accent[] = ['indigo', 'emerald', 'rose', 'amber', 'violet']

// Swatch colors for the picker (the light-mode primary of each scheme).
export const ACCENT_SWATCH: Record<Accent, string> = {
  indigo: '#4f46e5',
  emerald: '#059669',
  rose: '#e11d48',
  amber: '#d97706',
  violet: '#7c3aed',
}

interface ThemeState {
  mode: Mode
  accent: Accent
  resolved: 'light' | 'dark'
  setMode: (m: Mode) => void
  setAccent: (a: Accent) => void
  toggleMode: () => void
}

// Default keeps useTheme() usable outside a provider (e.g. isolated component
// tests) — setters no-op, so nothing persists, but nothing throws either.
const ThemeContext = createContext<ThemeState>({
  mode: 'system',
  accent: 'indigo',
  resolved: 'light',
  setMode: () => {},
  setAccent: () => {},
  toggleMode: () => {},
})

const MODE_KEY = 'ui.mode'
const ACCENT_KEY = 'ui.accent'

function systemDark() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches
}

function read<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  const v = typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null
  return v && (allowed as readonly string[]).includes(v) ? (v as T) : fallback
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<Mode>(() => read(MODE_KEY, ['light', 'dark', 'system'], 'system'))
  const [accent, setAccentState] = useState<Accent>(() => read(ACCENT_KEY, ACCENTS, 'indigo'))
  const [systemIsDark, setSystemIsDark] = useState(systemDark)

  // Track the OS preference so 'system' reacts live.
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => setSystemIsDark(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  const resolved: 'light' | 'dark' = mode === 'system' ? (systemIsDark ? 'dark' : 'light') : mode

  // Apply to <html> and persist.
  useEffect(() => {
    const root = document.documentElement
    root.setAttribute('data-theme', resolved)
    root.setAttribute('data-accent', accent)
  }, [resolved, accent])

  const setMode = (m: Mode) => {
    localStorage.setItem(MODE_KEY, m)
    setModeState(m)
  }
  const setAccent = (a: Accent) => {
    localStorage.setItem(ACCENT_KEY, a)
    setAccentState(a)
  }
  const toggleMode = () => setMode(resolved === 'dark' ? 'light' : 'dark')

  const value = useMemo<ThemeState>(
    () => ({ mode, accent, resolved, setMode, setAccent, toggleMode }),
    [mode, accent, resolved],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  return useContext(ThemeContext)
}
