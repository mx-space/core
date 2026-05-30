import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useParams, useSearchParams } from 'react-router'

import { findInListCache } from '~/api/list-cache'
import { getProject } from '~/api/projects'
import { useDocumentTitle } from '~/hooks/use-document-title'
import type { ProjectModel } from '~/models/project'
import { adminQueryKeys } from '~/query/keys'

import { projectsQueryKey } from '../constants'
import { ProjectDetailPanel } from './ProjectDetailPanel'
import { ProjectFormPanel } from './ProjectFormPanel'
import {
  ProjectDetailSkeleton,
  ProjectSelectPlaceholder,
} from './ProjectPrimitives'
import { useProjectsRouteContext } from './projects-route-context'

const LIST_PREFIX = [...projectsQueryKey, 'list'] as const

export function ProjectDetailRoute() {
  const { id } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const queryClient = useQueryClient()
  const ctx = useProjectsRouteContext()
  const isCreating = id === 'new'
  const isEditing = !isCreating && searchParams.get('edit') === '1'

  const initialProject =
    !isCreating && id
      ? findInListCache<ProjectModel>(queryClient, LIST_PREFIX, id)
      : undefined

  const projectQuery = useQuery({
    enabled: Boolean(id) && !isCreating,
    initialData: initialProject,
    queryFn: () => getProject(id!),
    queryKey: id ? adminQueryKeys.projects.detail(id) : projectsQueryKey,
    staleTime: initialProject ? 30_000 : 0,
  })

  useDocumentTitle(projectQuery.data?.name)

  if (isCreating) {
    return (
      <section className="h-full min-h-0">
        <ProjectFormPanel
          mode="create"
          onCancel={ctx.onClose}
          onMobileBack={ctx.onMobileBack}
          onSuccess={ctx.onCreated}
          project={null}
        />
      </section>
    )
  }

  if (!id) return <ProjectSelectPlaceholder />

  if (projectQuery.isLoading && !projectQuery.data) {
    return (
      <section className="h-full min-h-0">
        <ProjectDetailSkeleton />
      </section>
    )
  }

  if (!projectQuery.data) return <ProjectSelectPlaceholder />

  if (isEditing) {
    return (
      <section className="h-full min-h-0">
        <ProjectFormPanel
          mode="edit"
          onCancel={ctx.onStopEditing}
          onMobileBack={ctx.onMobileBack}
          onSuccess={ctx.onSaved}
          project={projectQuery.data}
        />
      </section>
    )
  }

  return (
    <section className="h-full min-h-0">
      <ProjectDetailPanel
        onClose={ctx.onClose}
        onDeleted={ctx.onDeleted}
        onEdit={ctx.onEdit}
        onMobileBack={ctx.onMobileBack}
        project={projectQuery.data}
      />
    </section>
  )
}

export default ProjectDetailRoute
