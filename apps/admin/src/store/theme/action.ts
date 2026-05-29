import type { StoreSetter } from '~/store/types'
import type { ThemeMode } from './initial-state'
import type { ThemeStore } from './store'

type Setter = StoreSetter<ThemeStore>

export class ThemeActionImpl {
  readonly #get: () => ThemeStore
  readonly #set: Setter

  constructor(set: Setter, get: () => ThemeStore, _api?: unknown) {
    void _api
    this.#set = set
    this.#get = get
  }

  setThemeMode = (themeMode: ThemeMode): void => {
    if (this.#get().themeMode === themeMode) return
    this.#set({ themeMode }, false, 'theme/setThemeMode')
  }
}

export const createThemeSlice = (
  set: Setter,
  get: () => ThemeStore,
  api: unknown,
) => new ThemeActionImpl(set, get, api)

export type ThemeAction = Pick<ThemeActionImpl, keyof ThemeActionImpl>
