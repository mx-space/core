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

export interface EnrichmentImagePalette {
  dominant: string
  swatches?: string[]
}

export interface EnrichmentResult {
  id?: string
  title: string
  description?: string
  thumbnailImage?: EnrichmentImage
  previewImage?: EnrichmentImage
  url: string
  category: string
  subtype?: string
  publishedAt?: string
  fetchedAt: string
  attributes?: EnrichmentAttribute[]
  color?: string
  links?: Array<{ rel: string; url: string; label?: string }>
  captureImage?: EnrichmentImage
}
