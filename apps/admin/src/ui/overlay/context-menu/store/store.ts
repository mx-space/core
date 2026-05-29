import { subscribeWithSelector } from 'zustand/middleware'
import { shallow } from 'zustand/shallow'
import { createWithEqualityFn } from 'zustand/traditional'
import type { StateCreator } from 'zustand/vanilla'
import type { ContextMenuAction } from './action'
import type { ContextMenuState } from './initial-state'

import { flattenActions } from '~/store/utils/flatten-actions'

import { createContextMenuSlice } from './action'
import { initialContextMenuState } from './initial-state'

export interface ContextMenuStore extends ContextMenuState, ContextMenuAction {}

const createStore: StateCreator<ContextMenuStore> = (...params) => ({
  ...initialContextMenuState,
  ...flattenActions<ContextMenuAction>([createContextMenuSlice(...params)]),
})

export const useContextMenuStore = createWithEqualityFn<ContextMenuStore>()(
  subscribeWithSelector(createStore),
  shallow,
)

export const getContextMenuStoreState = () => useContextMenuStore.getState()
