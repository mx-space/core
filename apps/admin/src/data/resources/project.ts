import { deleteProject } from '~/api/projects'
import { defineCollection } from '~/data/resource/collection'
import type { ProjectModel } from '~/models/project'

export const projects = defineCollection<ProjectModel>({
  name: 'project',
  getKey: (project) => project.id,
  onDelete: async ({ id }) => {
    await deleteProject(id)
  },
})
