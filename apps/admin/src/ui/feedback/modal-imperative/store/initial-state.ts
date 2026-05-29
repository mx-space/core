import type { ModalInstance } from '../types'

export interface ModalStoreState {
  stack: ModalInstance[]
}

export const initialModalStoreState: ModalStoreState = {
  stack: [],
}
