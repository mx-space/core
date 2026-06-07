import { useEffect, useRef } from 'react'

import { useModal } from './context'

type GuardFn = () => boolean

const guards = new Map<string, GuardFn>()

export function setDismissGuard(id: string, fn: GuardFn | null) {
  if (fn) guards.set(id, fn)
  else guards.delete(id)
}

export function getDismissGuard(id: string): GuardFn | undefined {
  return guards.get(id)
}

/**
 * Block backdrop/ESC dismissal while `isDirty` is true. The hosting modal will
 * prompt for confirmation before discarding. Intentional dismissal via
 * `modal.dismiss()` or `modal.close()` from inside the component bypasses this
 * guard — only the outer-click/ESC path is intercepted.
 */
export function useDismissGuard(isDirty: boolean) {
  const modal = useModal()
  const ref = useRef(isDirty)
  ref.current = isDirty
  useEffect(() => {
    const id = modal.id
    setDismissGuard(id, () => ref.current)
    return () => setDismissGuard(id, null)
  }, [modal.id])
}
