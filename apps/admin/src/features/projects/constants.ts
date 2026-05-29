import type { ProjectFormState } from './types/projects'

export const projectsQueryKey = ['projects']
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
