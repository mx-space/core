import { createContext, useContext } from 'react'

export interface DefinitionsRouteContextValue {
  onBack: () => void
}

export const DefinitionsRouteContext =
  createContext<DefinitionsRouteContextValue | null>(null)

export function useDefinitionsRouteContext(): DefinitionsRouteContextValue {
  const ctx = useContext(DefinitionsRouteContext)
  if (!ctx) {
    throw new Error(
      'useDefinitionsRouteContext must be used inside <DefinitionsRouteContext.Provider>',
    )
  }
  return ctx
}
