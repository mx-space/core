import type { ProjectModel } from '~/models/project'

import { ProjectDetailPanel } from './ProjectDetailPanel'
import { ProjectFormPanel } from './ProjectFormPanel'
import {
  ProjectDetailSkeleton,
  ProjectSelectPlaceholder,
} from './ProjectPrimitives'

export function ProjectWorkspace(props: {
  isCreating: boolean
  isEditing: boolean
  onClose: () => void
  onCreated: (project: ProjectModel) => Promise<void>
  onDeleted: () => Promise<void>
  onEdit: () => void
  onMobileBack: () => void
  onSaved: () => Promise<void>
  onStopEditing: () => void
  project: ProjectModel | null
  projectLoading: boolean
  selectedId: string | null
  showDetailOnMobile: boolean
}) {
  const workspaceClassName = 'h-full min-h-0'

  if (props.isCreating) {
    return (
      <section className={workspaceClassName}>
        <ProjectFormPanel
          mode="create"
          onCancel={props.onClose}
          onMobileBack={props.onMobileBack}
          onSuccess={props.onCreated}
          project={null}
        />
      </section>
    )
  }

  if (props.selectedId && props.projectLoading) {
    return (
      <section className={workspaceClassName}>
        <ProjectDetailSkeleton />
      </section>
    )
  }

  if (props.project && props.isEditing) {
    return (
      <section className={workspaceClassName}>
        <ProjectFormPanel
          mode="edit"
          onCancel={props.onStopEditing}
          onMobileBack={props.onMobileBack}
          onSuccess={props.onSaved}
          project={props.project}
        />
      </section>
    )
  }

  if (props.project) {
    return (
      <section className={workspaceClassName}>
        <ProjectDetailPanel
          onClose={props.onClose}
          onDeleted={props.onDeleted}
          onEdit={props.onEdit}
          onMobileBack={props.onMobileBack}
          project={props.project}
        />
      </section>
    )
  }

  return <ProjectSelectPlaceholder />
}
