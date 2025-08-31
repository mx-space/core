import { useSyncThemeark } from '~/hooks/common'

const useUISettingSync = () => {
  useSyncThemeark()
}

export const SettingSync = () => {
  useUISettingSync()

  return null
}
