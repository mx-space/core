import { subscribeWithSelector } from 'zustand/middleware'
import { shallow } from 'zustand/shallow'
import { createWithEqualityFn } from 'zustand/traditional'
import type { StateCreator } from 'zustand/vanilla'
import type { ModalAction } from './action'
import type { ModalStoreState } from './initial-state'

import { flattenActions } from '~/store/utils/flatten-actions'

import { createModalSlice } from './action'
import { initialModalStoreState } from './initial-state'

export interface ModalStore extends ModalStoreState, ModalAction {}

const createStore: StateCreator<ModalStore> = (...params) => ({
  ...initialModalStoreState,
  ...flattenActions<ModalAction>([createModalSlice(...params)]),
})

export const useModalStore = createWithEqualityFn<ModalStore>()(
  subscribeWithSelector(createStore),
  shallow,
)

export const getModalStoreState = () => useModalStore.getState()
