import { createContext, useContext } from 'react'

import type { AITask } from '~/api/tasks'

export interface TasksRouteContextValue {
  canceling: boolean
  deleting: boolean
  polling: boolean
  retrying: boolean
  onBack: () => void
  onCancel: (task: AITask) => void
  onDelete: (task: AITask) => void
  onRetry: (task: AITask) => void
}

export const TasksRouteContext = createContext<TasksRouteContextValue | null>(
  null,
)

export function useTasksRouteContext(): TasksRouteContextValue {
  const ctx = useContext(TasksRouteContext)
  if (!ctx) {
    throw new Error(
      'useTasksRouteContext must be used inside <TasksRouteContext.Provider>',
    )
  }
  return ctx
}
