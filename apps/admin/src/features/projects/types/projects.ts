import type { ProjectInput } from '~/api/projects'

export type ProjectFormState = ProjectInput & {
  imagesText: string
}

export type ProjectFormMode = 'create' | 'edit'

export type ProjectAvatarSize = 'large' | 'normal' | 'small'
