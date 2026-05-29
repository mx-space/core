import type { StoreSetter } from '~/store/types'
import type { FocusScopeStore } from './store'

type Setter = StoreSetter<FocusScopeStore>

let documentListenersAttached = false

function findScopeIdFromEvent(event: Event): string | null {
  const target = event.target instanceof Element ? event.target : null
  if (!target) return null
  const el = target.closest<HTMLElement>('[data-focus-scope]')
  return el?.dataset.focusScope ?? null
}

export class FocusScopeActionImpl {
  readonly #get: () => FocusScopeStore
  readonly #set: Setter

  constructor(set: Setter, get: () => FocusScopeStore, _api?: unknown) {
    void _api
    this.#set = set
    this.#get = get
    this.#ensureDocumentListeners()
  }

  setActiveScope = (id: string | null): void => {
    const { activeScopeId, knownScopes } = this.#get()
    if (id !== null && !knownScopes.has(id)) return
    if (activeScopeId === id) return
    this.#set({ activeScopeId: id }, false, 'setActiveScope')
  }

  registerScope = (id: string): (() => void) => {
    const map = new Map(this.#get().knownScopes)
    map.set(id, (map.get(id) ?? 0) + 1)
    this.#set({ knownScopes: map }, false, 'registerScope')
    return () => this.#unregisterScope(id)
  }

  #unregisterScope = (id: string): void => {
    const current = this.#get().knownScopes
    const count = current.get(id) ?? 0
    const next = new Map(current)
    if (count <= 1) {
      next.delete(id)
      this.#set(
        (state) => ({
          activeScopeId:
            state.activeScopeId === id ? null : state.activeScopeId,
          knownScopes: next,
        }),
        false,
        'unregisterScope',
      )
    } else {
      next.set(id, count - 1)
      this.#set({ knownScopes: next }, false, 'unregisterScope')
    }
  }

  #onGlobalInteract = (event: PointerEvent | FocusEvent) => {
    const id = findScopeIdFromEvent(event)
    // null = clicked / focused outside any scope → no change to active.
    // Clicking outside should not eagerly deactivate; keyboard shortcuts of
    // the last list remain available until the user enters a different
    // scope. Use `setActiveScope(null)` explicitly (e.g. on Escape) to clear.
    if (id == null) return
    this.setActiveScope(id)
  }

  #ensureDocumentListeners = (): void => {
    if (documentListenersAttached) return
    if (typeof document === 'undefined') return
    documentListenersAttached = true
    document.addEventListener('pointerdown', this.#onGlobalInteract, true)
    document.addEventListener('focusin', this.#onGlobalInteract, true)
  }
}

export const createFocusScopeSlice = (
  set: Setter,
  get: () => FocusScopeStore,
  api: unknown,
) => new FocusScopeActionImpl(set, get, api)

export type FocusScopeAction = Pick<
  FocusScopeActionImpl,
  keyof FocusScopeActionImpl
>
