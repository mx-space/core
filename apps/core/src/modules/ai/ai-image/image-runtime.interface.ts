export interface ImageGenerateOptions {
  prompt: string
  aspectRatio?: '1:1' | '3:2' | '2:3' | '4:3' | '3:4' | '16:9' | '9:16'
  quality?: 'low' | 'standard' | 'high'
  format?: 'png' | 'jpeg' | 'webp'
  referenceImages?: { data: Buffer; mimeType: string }[]
  providerParams?: Record<string, unknown>
  signal?: AbortSignal
}

export interface GeneratedImage {
  buffer: Buffer
  mimeType: string
}

export interface IImageRuntime {
  generateImage: (
    opts: ImageGenerateOptions,
  ) => Promise<{ images: GeneratedImage[] }>
  listModels?: () => Promise<{ id: string; provider: string }[]>
}
