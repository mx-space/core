export interface FocusScopeState {
  /** The currently-active scope id, or `null` when no scope is active. */
  activeScopeId: string | null
  /**
   * Refcount of mounted FocusScope instances by id. Multiple instances can
   * share the same id (e.g. the desktop sidebar `<aside>` and the mobile
   * drawer both render `id="sidebar"`); the active scope only clears when
   * the *last* instance unmounts.
   */
  knownScopes: Map<string, number>
}

export const initialFocusScopeState: FocusScopeState = {
  activeScopeId: null,
  knownScopes: new Map(),
}
