import { createContext, useContext } from 'react'

import type { AITask } from '~/api/ai'

export interface AiTasksRouteContextValue {
  canceling: boolean
  deleting: boolean
  polling: boolean
  retrying: boolean
  onBack: () => void
  onCancel: (task: AITask) => void
  onDelete: (task: AITask) => void
  onRetry: (task: AITask) => void
}

export const AiTasksRouteContext =
  createContext<AiTasksRouteContextValue | null>(null)

export function useAiTasksRouteContext(): AiTasksRouteContextValue {
  const ctx = useContext(AiTasksRouteContext)
  if (!ctx) {
    throw new Error(
      'useAiTasksRouteContext must be used inside <AiTasksRouteContext.Provider>',
    )
  }
  return ctx
}
