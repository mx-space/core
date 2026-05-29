import { useEffect, useMemo, useSyncExternalStore } from 'react'
import type { ThemeMode } from '~/store/theme'

import { useThemeStore } from '~/store/theme'

export const themeColors = {
  primary: '#1a9cf3',
  primaryDeep: '#0f7ec4',
  primaryShallow: '#4fb5f7',
} as const

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
  document.documentElement.style.setProperty(
    '--color-primary',
    themeColors.primary,
  )
  document.documentElement.style.setProperty(
    '--color-primary-shallow',
    themeColors.primaryShallow,
  )
  document.documentElement.style.setProperty(
    '--color-primary-deep',
    themeColors.primaryDeep,
  )
}

/** Imperative setter for callers outside React. */
export function setThemeMode(themeMode: ThemeMode) {
  useThemeStore.getState().setThemeMode(themeMode)
}
