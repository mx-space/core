import { createContext, useContext } from 'react'
import type { ModalHandle } from './types'

const ModalInstanceContext = createContext<ModalHandle<any> | null>(null)

export const ModalInstanceProvider = ModalInstanceContext.Provider

export function useModal<T = unknown>(): ModalHandle<T> {
  const ctx = useContext(ModalInstanceContext)
  if (!ctx) {
    throw new Error(
      'useModal() must be called inside a component rendered by present(). ' +
        'Did you forget to mount <ModalRoot/>?',
    )
  }
  return ctx as ModalHandle<T>
}
