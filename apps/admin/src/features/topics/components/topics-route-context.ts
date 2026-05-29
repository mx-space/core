import { createContext, useContext } from 'react'

import type { TopicModel } from '~/models/topic'

export interface TopicsRouteContextValue {
  deleting: boolean
  onBack: () => void
  onDelete: (topic: TopicModel) => void
  onEdit: (topic: TopicModel) => void
}

export const TopicsRouteContext = createContext<TopicsRouteContextValue | null>(
  null,
)

export function useTopicsRouteContext(): TopicsRouteContextValue {
  const ctx = useContext(TopicsRouteContext)
  if (!ctx) {
    throw new Error(
      'useTopicsRouteContext must be used inside <TopicsRouteContext.Provider>',
    )
  }
  return ctx
}
