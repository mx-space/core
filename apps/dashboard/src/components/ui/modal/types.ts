import type { FC } from 'react'

import type { DialogContentProps } from '../dialog'

export type ModalComponentProps = {
  modalId: string
  dismiss: () => void
}

export type ModalComponent<P = unknown> = FC<ModalComponentProps & P> & {
  contentProps?: Partial<DialogContentProps>
  contentClassName?: string
}

export type ModalContentConfig = Partial<DialogContentProps>

export type ModalItem = {
  id: string
  component: ModalComponent<any>
  props?: unknown
  modalContent?: ModalContentConfig
}
