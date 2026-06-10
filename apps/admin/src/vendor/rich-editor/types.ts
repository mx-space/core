import type { LitexmlRegistryProvider } from '@haklex/rich-agent-core'
import type { useAgentLoop } from '@haklex/rich-ext-ai-agent'

import type { RichEditorProps } from './core'

export type SaveExcalidrawSnapshot = (
  snapshot: object,
  existingRef?: string,
) => Promise<string>

// Admin-safe alias so consumers don't need to depend on React-bound types
export type ImageUpload = NonNullable<RichEditorProps['imageUpload']>

export type TrackUpload = (file: File) => Promise<{ url: string }>

export type VideoUpload = (
  file: File,
  opts?: { onProgress?: (percent: number) => void },
) => Promise<{ src: string }>

export type AgentLoopHandle = ReturnType<typeof useAgentLoop>

export type AgentLitexmlRegistryProvider = LitexmlRegistryProvider

export interface EnrichmentImagePalette {
  dominant: string
  swatches?: string[]
}

export interface EnrichmentImage {
  url: string
  width?: number
  height?: number
  alt?: string
  thumbhash?: string
  palette?: EnrichmentImagePalette
}

export interface EnrichmentAttribute {
  key: string
  value: string | number | boolean
  label?: string
  format?: 'number' | 'rating' | 'date' | 'percent' | 'text' | 'duration'
}

export interface EnrichmentResult {
  title: string
  description?: string
  thumbnailImage?: EnrichmentImage
  previewImage?: EnrichmentImage
  url: string
  category: string
  subtype?: string
  publishedAt?: string
  fetchedAt?: string
  attributes?: EnrichmentAttribute[]
  color?: string
  links?: Array<{ rel: string; url: string; label?: string }>
  captureImage?: EnrichmentImage
}
