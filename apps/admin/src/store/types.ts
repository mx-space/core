/**
 * Zustand setter signature mirroring the `set` parameter passed to the
 * store creator. Includes the optional third action-name argument for
 * the `devtools` middleware.
 *
 * Cribbed from lobe-chat's `src/store/types.ts` so the action-class
 * pattern (`this.#set({...}, false, 'actionName')`) carries cleanly.
 */
export interface StoreSetter<TStore> {
  (
    partial:
      | TStore
      | Partial<TStore>
      | ((state: TStore) => TStore | Partial<TStore>),
    replace?: false | undefined,
    action?: unknown,
  ): void
  (
    state: TStore | ((state: TStore) => TStore),
    replace: true,
    action?: unknown,
  ): void
}
