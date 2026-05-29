import type { ComponentType } from 'react'
import type {
  ModalHandle,
  ModalInstance,
  PresentOptions,
  ResolvedPresentOptions,
} from './types'

import { modalStore } from './store'

function resolveOptions(options?: PresentOptions): ResolvedPresentOptions {
  return {
    modalProps: options?.modalProps ?? {},
    dismissable: options?.dismissable ?? true,
  }
}

export function present<P extends object, T = unknown>(
  Component: ComponentType<P>,
  props: P,
  options?: PresentOptions,
): ModalHandle<T> {
  const id = crypto.randomUUID()
  let resolveDeferred!: (value: T | undefined) => void
  let settled = false
  const promise = new Promise<T | undefined>((resolve) => {
    resolveDeferred = resolve
  })

  const close = (value?: T) => {
    if (settled) return
    const current = modalStore.find(id)
    if (!current || current.status !== 'open') return
    settled = true
    resolveDeferred(value)
    modalStore.update(id, { status: 'closing' })
  }
  const dismiss = () => close(undefined)
  const update = <UP>(propsPatch: Partial<UP>) => {
    const current = modalStore.find(id)
    if (!current || current.status !== 'open') return
    modalStore.patchProps(id, propsPatch as Record<string, unknown>)
  }

  const handle: ModalHandle<T> = {
    id,
    close,
    dismiss,
    update,
    // eslint-disable-next-line unicorn/no-thenable -- PromiseLike by design: `await handle` should yield the close value.
    then: (onFulfilled, onRejected) => promise.then(onFulfilled, onRejected),
  }

  const instance: ModalInstance<P, T> = {
    id,
    Component,
    props,
    options: resolveOptions(options),
    handle,
    status: 'open',
  }
  modalStore.push(instance as ModalInstance)

  return handle
}
