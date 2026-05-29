import type { ProjectModel, ProjectResponse } from '~/models/project'

import { deleteJson, getJson, postJson, putJson } from './http'

export interface ProjectInput {
  avatar?: string
  description: string
  docUrl?: string
  images?: string[]
  name: string
  previewUrl?: string
  projectUrl?: string
  text: string
}

export function getProjects(params: { page: number; size: number }) {
  return getJson<ProjectResponse>('/projects', params)
}

export function getProject(id: string) {
  return getJson<ProjectModel>(`/projects/${id}`)
}

export function createProject(data: ProjectInput) {
  return postJson<ProjectModel, ProjectInput>('/projects', data)
}

export function updateProject(id: string, data: Partial<ProjectInput>) {
  return putJson<ProjectModel, Partial<ProjectInput>>(`/projects/${id}`, data)
}

export function deleteProject(id: string) {
  return deleteJson<void>(`/projects/${id}`)
}
