import type { StoreSetter } from '~/store/types'
import type { ModalInstance } from '../types'
import type { ModalStore } from './store'

type Setter = StoreSetter<ModalStore>

export class ModalActionImpl {
  readonly #get: () => ModalStore
  readonly #set: Setter

  constructor(set: Setter, get: () => ModalStore, _api?: unknown) {
    void _api
    this.#set = set
    this.#get = get
  }

  push = (inst: ModalInstance): void => {
    this.#set(
      (state) => ({ stack: [...state.stack, inst] }),
      false,
      'modal/push',
    )
  }

  update = (id: string, patch: Partial<ModalInstance>): void => {
    let changed = false
    const next = this.#get().stack.map((inst) => {
      if (inst.id !== id) return inst
      changed = true
      return { ...inst, ...patch }
    })
    if (changed) this.#set({ stack: next }, false, 'modal/update')
  }

  patchProps = (id: string, propsPatch: Record<string, unknown>): void => {
    let changed = false
    const next = this.#get().stack.map((inst) => {
      if (inst.id !== id) return inst
      changed = true
      return {
        ...inst,
        props: { ...(inst.props as object), ...propsPatch },
      }
    })
    if (changed) this.#set({ stack: next }, false, 'modal/patchProps')
  }

  remove = (id: string): void => {
    const current = this.#get().stack
    const next = current.filter((inst) => inst.id !== id)
    if (next.length !== current.length) {
      this.#set({ stack: next }, false, 'modal/remove')
    }
  }

  find = (id: string): ModalInstance | undefined => {
    return this.#get().stack.find((inst) => inst.id === id)
  }
}

export const createModalSlice = (
  set: Setter,
  get: () => ModalStore,
  api: unknown,
) => new ModalActionImpl(set, get, api)

export type ModalAction = Pick<ModalActionImpl, keyof ModalActionImpl>
