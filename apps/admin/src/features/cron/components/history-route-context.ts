import { createContext, useContext } from 'react'

export interface HistoryRouteContextValue {
  onBack: () => void
  onCancel: (taskId: string) => void
  onDelete: (taskId: string) => void
  onRetry: (taskId: string) => void
}

export const HistoryRouteContext =
  createContext<HistoryRouteContextValue | null>(null)

export function useHistoryRouteContext(): HistoryRouteContextValue {
  const ctx = useContext(HistoryRouteContext)
  if (!ctx) {
    throw new Error(
      'useHistoryRouteContext must be used inside <HistoryRouteContext.Provider>',
    )
  }
  return ctx
}
