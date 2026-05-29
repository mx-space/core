import { useFocusScopeStore } from './store'

/** Returns the currently-active scope id, or `null` if none. */
export function useActiveFocusScopeId(): string | null {
  return useFocusScopeStore((state) => state.activeScopeId)
}

/** True when the named scope is the currently-active one. */
export function useFocusScopeActive(scopeId: string): boolean {
  return useFocusScopeStore((state) => state.activeScopeId === scopeId)
}

/** Imperative setter, callable outside React. */
export function setActiveScope(id: string | null): void {
  useFocusScopeStore.getState().setActiveScope(id)
}

/** Imperative read, callable outside React. */
export function getActiveScopeId(): string | null {
  return useFocusScopeStore.getState().activeScopeId
}

/**
 * Imperative scope registration. Returns an unregister function.
 * Multiple registrations of the same id are refcounted.
 */
export function registerFocusScope(id: string): () => void {
  return useFocusScopeStore.getState().registerScope(id)
}
