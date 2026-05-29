import { subscribeWithSelector } from 'zustand/middleware'
import { shallow } from 'zustand/shallow'
import { createWithEqualityFn } from 'zustand/traditional'
import type { StateCreator } from 'zustand/vanilla'
import type { FocusScopeAction } from './action'
import type { FocusScopeState } from './initial-state'

import { flattenActions } from '~/store/utils/flatten-actions'

import { createFocusScopeSlice } from './action'
import { initialFocusScopeState } from './initial-state'

export interface FocusScopeStore extends FocusScopeState, FocusScopeAction {}

const createStore: StateCreator<FocusScopeStore> = (...params) => ({
  ...initialFocusScopeState,
  ...flattenActions<FocusScopeAction>([createFocusScopeSlice(...params)]),
})

export const useFocusScopeStore = createWithEqualityFn<FocusScopeStore>()(
  subscribeWithSelector(createStore),
  shallow,
)

export const getFocusScopeStoreState = () => useFocusScopeStore.getState()
