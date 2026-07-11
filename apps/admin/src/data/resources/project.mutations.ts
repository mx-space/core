import type { ProjectInput } from '~/api/projects'
import { createProject, updateProject } from '~/api/projects'
import { createTransaction } from '~/data/resource/transaction'
import type { ProjectModel } from '~/models/project'

import { projects } from './project'

export async function saveProject(
  mode: { kind: 'create' } | { id: string; kind: 'edit' },
  form: ProjectInput,
): Promise<ProjectModel> {
  if (mode.kind === 'edit') {
    const { id } = mode
    const tx = createTransaction()
    tx.update(projects, id, (draft) => {
      draft.name = form.name
      draft.description = form.description
      draft.previewUrl = form.previewUrl ?? null
      draft.docUrl = form.docUrl ?? null
      draft.projectUrl = form.projectUrl ?? null
      draft.images = form.images ?? null
      draft.avatar = form.avatar ?? null
      draft.text = form.text
    })
    const result = await tx.commit(() => updateProject(id, form))
    projects.hydrate([result])
    return result
  }

  const result = await createProject(form)
  projects.upsert(result)
  return result
}

export function removeProject(id: string): Promise<void> {
  return projects.delete(id)
}
