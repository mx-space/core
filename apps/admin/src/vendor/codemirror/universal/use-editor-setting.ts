import { z } from 'zod'
import type { GeneralSettingDto } from './editor-config'

import { GeneralSettingSchema } from './editor-config'
import { useEditorSettingStore } from './editor-setting-store'

export function getGeneralSetting(): GeneralSettingDto {
  return useEditorSettingStore.getState().general
}

export function setGeneralSetting(
  patch:
    | Partial<GeneralSettingDto>
    | ((prev: GeneralSettingDto) => GeneralSettingDto),
): void {
  useEditorSettingStore.getState().setGeneralSetting(patch)
}

export function resetGeneralSetting(): void {
  useEditorSettingStore.getState().resetGeneralSetting()
}

export function useGeneralSetting(): GeneralSettingDto {
  return useEditorSettingStore((s) => s.general)
}

export function useEditorConfig() {
  const setting = useGeneralSetting()
  return {
    general: {
      setting,
      set: setGeneralSetting,
      reset: resetGeneralSetting,
    },
  }
}

export { GeneralSettingSchema }
export type { GeneralSettingDto }
export { z }
