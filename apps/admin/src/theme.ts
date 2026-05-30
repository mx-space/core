import { useEffect, useMemo, useSyncExternalStore } from 'react'

import type { ThemeMode } from '~/store/theme'
import { useThemeStore } from '~/store/theme'

export type { ThemeMode }

const DARK_QUERY = '(prefers-color-scheme: dark)'

/**
 * Reads the persisted theme mode from the Zustand store and resolves it
 * against the OS preference. The OS-preference side still goes through
 * `useSyncExternalStore` because the source is a `MediaQueryList`, not
 * React state.
 */
export function useThemeMode() {
  const themeMode = useThemeStore((s) => s.themeMode)
  const setThemeMode = useThemeStore((s) => s.setThemeMode)

  const query = useMemo(() => window.matchMedia(DARK_QUERY), [])
  const systemMatches = useSyncExternalStore(
    (onChange) => {
      query.addEventListener('change', onChange)
      return () => query.removeEventListener('change', onChange)
    },
    () => query.matches,
    () => false,
  )

  const resolvedTheme: 'dark' | 'light' =
    themeMode === 'system' ? (systemMatches ? 'dark' : 'light') : themeMode
  const isDark = resolvedTheme === 'dark'

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark)
  }, [isDark])

  return { isDark, setThemeMode, themeMode }
}

export function installThemeTokens() {
  // Legacy --color-primary* aliases for any code still reading them.
  // New code uses --color-accent* via tokens.css.
  const root = document.documentElement.style
  root.setProperty('--color-primary', '#2563eb')
  root.setProperty('--color-primary-shallow', '#3b82f6')
  root.setProperty('--color-primary-deep', '#1d4ed8')
}

/** Imperative setter for callers outside React. */
export function setThemeMode(themeMode: ThemeMode) {
  useThemeStore.getState().setThemeMode(themeMode)
}
