import type { StoreSetter } from '~/store/types'
import type { GeneralSettingDto } from '../editor-config'
import type { EditorSettingStore } from './store'

import { GeneralSettingSchema } from '../editor-config'

type Setter = StoreSetter<EditorSettingStore>

export class EditorSettingActionImpl {
  readonly #get: () => EditorSettingStore
  readonly #set: Setter

  constructor(set: Setter, get: () => EditorSettingStore, _api?: unknown) {
    void _api
    this.#set = set
    this.#get = get
  }

  setGeneralSetting = (
    patch:
      | Partial<GeneralSettingDto>
      | ((prev: GeneralSettingDto) => GeneralSettingDto),
  ): void => {
    const prev = this.#get().general
    const merged =
      typeof patch === 'function' ? patch(prev) : { ...prev, ...patch }
    const next = GeneralSettingSchema.parse(merged)
    this.#set({ general: next }, false, 'editorSetting/setGeneral')
  }

  resetGeneralSetting = (): void => {
    this.#set(
      { general: GeneralSettingSchema.parse({}) },
      false,
      'editorSetting/resetGeneral',
    )
  }
}

export const createEditorSettingSlice = (
  set: Setter,
  get: () => EditorSettingStore,
  api: unknown,
) => new EditorSettingActionImpl(set, get, api)

export type EditorSettingAction = Pick<
  EditorSettingActionImpl,
  keyof EditorSettingActionImpl
>
