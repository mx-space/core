import type { ModalInstance } from '../types'

import { useModalStore } from './store'

export type { ModalAction } from './action'
export type { ModalStoreState } from './initial-state'
export type { ModalStore } from './store'
export { getModalStoreState, useModalStore } from './store'

/**
 * Imperative API mirroring the prior `modalStore` namespace so callers like
 * `present.ts` keep their existing shape.
 */
export const modalStore = {
  subscribe: useModalStore.subscribe,
  getSnapshot: () => useModalStore.getState().stack,
  push: (inst: ModalInstance) => useModalStore.getState().push(inst),
  update: (id: string, patch: Partial<ModalInstance>) =>
    useModalStore.getState().update(id, patch),
  patchProps: (id: string, propsPatch: Record<string, unknown>) =>
    useModalStore.getState().patchProps(id, propsPatch),
  remove: (id: string) => useModalStore.getState().remove(id),
  find: (id: string) => useModalStore.getState().find(id),
} as const
