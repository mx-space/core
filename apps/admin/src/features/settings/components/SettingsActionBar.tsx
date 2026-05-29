import { createContext, useContext } from 'react'

export type SettingsDirtyAction = {
  count: number
  onDiscard: () => void
  onSaveAll: () => void
  saving: boolean
}

export const SettingsActionBarContext = createContext<
  (action: SettingsDirtyAction | null) => void
>(() => {})

export function useSettingsActionBarSetter() {
  return useContext(SettingsActionBarContext)
}
