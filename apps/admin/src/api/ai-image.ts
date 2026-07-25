import { getJson, postJson } from './http'

export interface ImageDraftPromptRecipe {
  accent: string
  anchor: string
  family: string
  format: string
  geometry: string
  polarity: string
  scaffold: string
  text: string
  transformation: string
}

export interface ImageDraftPromptResponse {
  prompt: string
  recipe: ImageDraftPromptRecipe
}

export interface DraftImagePromptData {
  presetId: string
  refId?: string
  summary?: string
  title?: string
}

export interface ImagePreset {
  defaultAspectRatio: string
  id: string
  label: string
}

export type ImageGeneratePurpose = 'cover' | 'inline'

export interface GenerateImageData {
  prompt: string
  presetId?: string
  purpose: ImageGeneratePurpose
  refId?: string
  requestId: string
}

export interface GenerateImageResponse {
  created: boolean
  taskId: string
}

export function draftImagePrompt(data: DraftImagePromptData) {
  return postJson<ImageDraftPromptResponse, DraftImagePromptData>(
    '/ai/image/draft-prompt',
    data,
  )
}

export function generateImage(data: GenerateImageData) {
  return postJson<GenerateImageResponse, GenerateImageData>(
    '/ai/image/generate',
    data,
  )
}

export function getImagePresets() {
  return getJson<ImagePreset[]>('/ai/image/presets')
}
