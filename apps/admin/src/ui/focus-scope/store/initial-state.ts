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
  /**
   * Per-scope memory of the last item id (the `data-id` attribute) that
   * received keyboard focus inside the scope. Used by the scope switcher
   * to restore the cursor when the user returns to a scope.
   */
  lastFocusedItemPerScope: Map<string, string>
}

export const initialFocusScopeState: FocusScopeState = {
  activeScopeId: null,
  knownScopes: new Map(),
  lastFocusedItemPerScope: new Map(),
}
