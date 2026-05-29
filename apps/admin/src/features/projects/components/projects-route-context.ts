import { createContext, useContext } from 'react'

import type { ProjectModel } from '~/models/project'

export interface ProjectsRouteContextValue {
  onClose: () => void
  onMobileBack: () => void
  onCreated: (project: ProjectModel) => Promise<void>
  onSaved: () => Promise<void>
  onDeleted: () => Promise<void>
  onEdit: () => void
  onStopEditing: () => void
}

export const ProjectsRouteContext =
  createContext<ProjectsRouteContextValue | null>(null)

export function useProjectsRouteContext(): ProjectsRouteContextValue {
  const ctx = useContext(ProjectsRouteContext)
  if (!ctx) {
    throw new Error(
      'useProjectsRouteContext must be used inside <ProjectsRouteContext.Provider>',
    )
  }
  return ctx
}
