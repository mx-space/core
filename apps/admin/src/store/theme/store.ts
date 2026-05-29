import { persist, subscribeWithSelector } from 'zustand/middleware'
import { shallow } from 'zustand/shallow'
import { createWithEqualityFn } from 'zustand/traditional'
import type { StateCreator } from 'zustand/vanilla'
import type { ThemeAction } from './action'
import type { ThemeMode, ThemeState } from './initial-state'

import { flattenActions } from '~/store/utils/flatten-actions'

import { createThemeSlice } from './action'
import { initialThemeState } from './initial-state'

export interface ThemeStore extends ThemeState, ThemeAction {}

const STORAGE_KEY = 'theme-mode'

const isValidMode = (value: unknown): value is ThemeMode =>
  value === 'dark' || value === 'light' || value === 'system'

const createStore: StateCreator<ThemeStore> = (...params) => ({
  ...initialThemeState,
  ...flattenActions<ThemeAction>([createThemeSlice(...params)]),
})

export const useThemeStore = createWithEqualityFn<ThemeStore>()(
  subscribeWithSelector(
    persist(createStore, {
      name: STORAGE_KEY,
      partialize: (state) => ({ themeMode: state.themeMode }),
      // Legacy storage layout: just the raw mode string (no JSON envelope).
      // Read it on load and write back via the modern envelope on first set.
      storage: {
        getItem: (name) => {
          if (typeof window === 'undefined') return null
          const raw = window.localStorage.getItem(name)
          if (!raw) return null
          const stripped = raw.replace(/^"|"$/g, '')
          if (isValidMode(stripped)) {
            return { state: { themeMode: stripped }, version: 0 }
          }
          try {
            return JSON.parse(raw)
          } catch {
            return null
          }
        },
        setItem: (name, value) => {
          if (typeof window === 'undefined') return
          // Persist `system` as removal so the storage event mirrors the
          // prior contract — listeners don't need to special-case it.
          if (value.state.themeMode === 'system') {
            window.localStorage.removeItem(name)
          } else {
            window.localStorage.setItem(name, JSON.stringify(value))
          }
        },
        removeItem: (name) => {
          if (typeof window === 'undefined') return
          window.localStorage.removeItem(name)
        },
      },
    }),
  ),
  shallow,
)

export const getThemeStoreState = () => useThemeStore.getState()
