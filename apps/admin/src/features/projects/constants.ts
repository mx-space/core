import type { ProjectFormState } from './types/projects'
import { adminQueryKeys } from '~/query/keys'

export const projectsQueryKey = adminQueryKeys.projects.root
export const projectsPageSize = 20

export const emptyProjectForm: ProjectFormState = {
  avatar: '',
  description: '',
  docUrl: '',
  images: [],
  imagesText: '',
  name: '',
  previewUrl: '',
  projectUrl: '',
  text: '',
}
