/**
 * Flatten one or more action-class instances into a single object whose
 * methods are bound to their owning instance. Used when assembling a
 * Zustand store from slice classes — class instances can't be spread
 * cleanly because methods live on the prototype.
 *
 * Each method is bound to the original instance so `this` resolves
 * correctly when callers invoke `store.someAction()`.
 *
 * Cribbed from lobe-chat's `src/store/utils/flattenActions.ts`.
 */
export function flattenActions<T extends object>(actions: object[]): T {
  const result = {} as T

  for (const action of actions) {
    let current: object | null = action
    while (current && current !== Object.prototype) {
      const keys = Object.getOwnPropertyNames(current)

      for (const key of keys) {
        if (key === 'constructor') continue
        if (key in result) continue

        const descriptor = Object.getOwnPropertyDescriptor(current, key)
        if (!descriptor) continue

        if (typeof descriptor.value === 'function') {
          ;(result as Record<string, unknown>)[key] =
            descriptor.value.bind(action)
        } else {
          Object.defineProperty(result, key, {
            ...descriptor,
            configurable: true,
            enumerable: true,
          })
        }
      }

      current = Object.getPrototypeOf(current)
    }
  }

  return result
}
