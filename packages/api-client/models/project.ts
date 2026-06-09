export interface ProjectModel {
  id: string
  createdAt: string
  name: string
  description: string
  previewUrl: string | null
  docUrl: string | null
  projectUrl: string | null
  images: string[] | null
  avatar: string | null
  text: string | null
}

export interface ProjectCreateInput {
  name: string
  description: string
  previewUrl?: string | null
  docUrl?: string | null
  projectUrl?: string | null
  avatar?: string | null
  images?: string[] | null
  text?: string | null
}

export type ProjectPatchInput = Partial<ProjectCreateInput>
