import { createContext, useContext } from 'react'

import type { ConfigFormSchema } from '~/api/options'

import type { SettingsGroupSummary } from '../types/settings'

export interface SettingsRouteContextValue {
  groups: SettingsGroupSummary[]
  schema: ConfigFormSchema | undefined
  onBack: () => void
  onOwnerSaved: () => Promise<unknown> | void
}

export const SettingsRouteContext =
  createContext<SettingsRouteContextValue | null>(null)

export function useSettingsRouteContext(): SettingsRouteContextValue {
  const ctx = useContext(SettingsRouteContext)
  if (!ctx) {
    throw new Error(
      'useSettingsRouteContext must be used inside <SettingsRouteContext.Provider>',
    )
  }
  return ctx
}
