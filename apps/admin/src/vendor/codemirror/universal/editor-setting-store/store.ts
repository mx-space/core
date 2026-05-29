import { persist, subscribeWithSelector } from 'zustand/middleware'
import { shallow } from 'zustand/shallow'
import { createWithEqualityFn } from 'zustand/traditional'
import type { StateCreator } from 'zustand/vanilla'
import type { EditorSettingAction } from './action'
import type { EditorSettingState } from './initial-state'

import { flattenActions } from '~/store/utils/flatten-actions'

import { GeneralSettingSchema } from '../editor-config'
import { createEditorSettingSlice } from './action'
import { initialEditorSettingState } from './initial-state'

export interface EditorSettingStore
  extends EditorSettingState, EditorSettingAction {}

const STORAGE_KEY = 'editor-general'

const createStore: StateCreator<EditorSettingStore> = (...params) => ({
  ...initialEditorSettingState,
  ...flattenActions<EditorSettingAction>([createEditorSettingSlice(...params)]),
})

export const useEditorSettingStore = createWithEqualityFn<EditorSettingStore>()(
  subscribeWithSelector(
    persist(createStore, {
      name: STORAGE_KEY,
      partialize: (state) => ({ general: state.general }),
      // The legacy format stored the bare `GeneralSettingDto` object at
      // `editor-general`. Read it as-is and write back via the modern
      // envelope on first set.
      storage: {
        getItem: (name) => {
          if (typeof window === 'undefined') return null
          const raw = window.localStorage.getItem(name)
          if (!raw) return null
          try {
            const parsed = JSON.parse(raw)
            if (parsed && typeof parsed === 'object' && 'state' in parsed) {
              return parsed
            }
            return {
              state: { general: GeneralSettingSchema.parse(parsed) },
              version: 0,
            }
          } catch {
            return null
          }
        },
        setItem: (name, value) => {
          if (typeof window === 'undefined') return
          try {
            window.localStorage.setItem(name, JSON.stringify(value))
          } catch {
            /* ignore quota */
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

export const getEditorSettingStoreState = () => useEditorSettingStore.getState()
