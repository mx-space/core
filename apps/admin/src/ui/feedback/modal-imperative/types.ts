import type { ModalProps } from '~/ui/feedback/modal'
import type { ComponentType } from 'react'

export type ModalPropsOverride = Partial<
  Omit<
    ModalProps,
    'children' | 'onClose' | 'onExitComplete' | 'onOpenChange' | 'open'
  >
>

export interface PresentOptions {
  modalProps?: ModalPropsOverride
  /** When false, backdrop click and ESC do not close the modal. Default: true. */
  dismissable?: boolean
}

export interface ResolvedPresentOptions {
  modalProps: ModalPropsOverride
  dismissable: boolean
}

export interface ModalHandle<T = unknown> extends PromiseLike<T | undefined> {
  id: string
  close: (value?: T) => void
  dismiss: () => void
  update: <P>(propsPatch: Partial<P>) => void
}

export interface ModalInstance<P = any, T = unknown> {
  id: string
  Component: ComponentType<P>
  props: P
  options: ResolvedPresentOptions
  handle: ModalHandle<T>
  status: 'open' | 'closing'
}
