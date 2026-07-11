import { useParams, useSearchParams } from 'react-router'

import { getProject } from '~/api/projects'
import { useCollectionDetailQuery, useEntity } from '~/data/resource/hooks'
import { projects } from '~/data/resources/project'
import { useDocumentTitle } from '~/hooks/use-document-title'
import { adminQueryKeys } from '~/query/keys'

import { ProjectDetailPanel } from './ProjectDetailPanel'
import { ProjectFormPanel } from './ProjectFormPanel'
import {
  ProjectDetailSkeleton,
  ProjectSelectPlaceholder,
} from './ProjectPrimitives'
import { useProjectsRouteContext } from './projects-route-context'

export function ProjectDetailRoute() {
  const { id } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const ctx = useProjectsRouteContext()
  const isCreating = id === 'new'
  const isEditing = !isCreating && searchParams.get('edit') === '1'

  const project = useEntity(projects, isCreating ? undefined : id)

  const projectQuery = useCollectionDetailQuery(projects, {
    enabled: Boolean(id) && !isCreating,
    queryFn: () => getProject(id!),
    queryKey: id
      ? adminQueryKeys.projects.detail(id)
      : adminQueryKeys.projects.root,
  })

  useDocumentTitle(project?.name)

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

  if (projectQuery.isLoading && !project) {
    return (
      <section className="h-full min-h-0">
        <ProjectDetailSkeleton />
      </section>
    )
  }

  if (!project) return <ProjectSelectPlaceholder />

  if (isEditing) {
    return (
      <section className="h-full min-h-0">
        <ProjectFormPanel
          mode="edit"
          onCancel={ctx.onStopEditing}
          onMobileBack={ctx.onMobileBack}
          onSuccess={ctx.onSaved}
          project={project}
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
        project={project}
      />
    </section>
  )
}

export default ProjectDetailRoute
