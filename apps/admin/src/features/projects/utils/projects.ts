import type { ProjectInput } from '~/api/projects'
import type { ProjectModel } from '~/models/project'
import type { ProjectFormState } from '../types/projects'

export function projectToForm(project: ProjectModel): ProjectFormState {
  return {
    avatar: project.avatar ?? '',
    description: project.description ?? '',
    docUrl: project.docUrl ?? '',
    images: project.images ?? [],
    imagesText: (project.images ?? []).join('\n'),
    name: project.name ?? '',
    previewUrl: project.previewUrl ?? '',
    projectUrl: project.projectUrl ?? '',
    text: project.text ?? '',
  }
}

export function formToPayload(form: ProjectFormState): ProjectInput {
  return {
    avatar: emptyToUndefined(form.avatar),
    description: form.description.trim(),
    docUrl: emptyToUndefined(form.docUrl),
    images: form.imagesText
      .split('\n')
      .map((image) => image.trim())
      .filter(Boolean),
    name: form.name.trim(),
    previewUrl: emptyToUndefined(form.previewUrl),
    projectUrl: emptyToUndefined(form.projectUrl),
    text: form.text.trim(),
  }
}

export function emptyToUndefined(value?: string) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

export function readInitial(value: string) {
  return value.slice(0, 1).toUpperCase()
}

export function readPage(value: string | null) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1
}

export function parseGithubRepo(value: string) {
  const trimmed = value
    .trim()
    .replace(/\.git$/, '')
    .replace(/\/$/, '')
  const path = trimmed.startsWith('http')
    ? new URL(trimmed).pathname.replace(/^\/+/, '')
    : trimmed
  const [owner, repo] = path.split('/')

  if (!owner || !repo) throw new Error('projects.github.invalidUrl')

  return { owner, repo }
}

export function pickImagesFromMarkdown(text: string) {
  const images: string[] = []
  const imagePattern = /!\[[^\]]*]\(([^)\s]+)(?:\s+"[^"]*")?\)/g

  for (const match of text.matchAll(imagePattern)) {
    if (match[1]) images.push(match[1])
  }

  return images
}

export function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error

  return fallback
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}
