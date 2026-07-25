export type ImageParameterDescriptor =
  | { type: 'enum'; values: string[] }
  | { type: 'range'; min: number; max: number }
  | { type: 'boolean' }

export interface ImageCatalogModel {
  id: string
  supportedParameters: Record<string, ImageParameterDescriptor>
}

export interface ImageCatalogFetchConfig {
  endpoint?: string
  apiKey?: string
}

const DEFAULT_OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1'

export function resolveOpenRouterImagesBaseUrl(endpoint?: string): string {
  const trimmed = endpoint?.trim()
  return trimmed || DEFAULT_OPENROUTER_BASE_URL
}

export async function fetchImageCatalog(
  config: ImageCatalogFetchConfig,
): Promise<ImageCatalogModel[]> {
  const baseUrl = resolveOpenRouterImagesBaseUrl(config.endpoint)
  const response = await fetch(`${baseUrl}/images/models`, {
    headers: config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {},
  })
  if (!response.ok) {
    throw new Error(
      `image models catalog request failed with status ${response.status}`,
    )
  }
  const payload = (await response.json()) as { data?: unknown }
  if (!Array.isArray(payload.data)) return []
  return payload.data
    .map((item) => parseImageCatalogModel(item))
    .filter((item): item is ImageCatalogModel => item !== null)
}

export async function fetchImageCatalogModel(
  config: ImageCatalogFetchConfig,
  modelId: string,
): Promise<ImageCatalogModel | undefined> {
  const models = await fetchImageCatalog(config)
  return models.find((model) => model.id === modelId)
}

function parseImageCatalogModel(raw: unknown): ImageCatalogModel | null {
  if (typeof raw !== 'object' || raw === null) return null
  const { id, supported_parameters } = raw as Record<string, unknown>
  if (typeof id !== 'string' || id.length === 0) return null
  return {
    id,
    supportedParameters: parseSupportedParameters(supported_parameters),
  }
}

function parseSupportedParameters(
  raw: unknown,
): Record<string, ImageParameterDescriptor> {
  if (typeof raw !== 'object' || raw === null) return {}
  const result: Record<string, ImageParameterDescriptor> = {}
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const descriptor = parseParameterDescriptor(value)
    if (descriptor) result[key] = descriptor
  }
  return result
}

function parseParameterDescriptor(
  value: unknown,
): ImageParameterDescriptor | null {
  if (typeof value !== 'object' || value === null) return null
  const { type, values, min, max } = value as Record<string, unknown>
  switch (type) {
    case 'enum': {
      if (!Array.isArray(values)) return null
      return {
        type: 'enum',
        values: values.filter((v): v is string => typeof v === 'string'),
      }
    }
    case 'range': {
      if (typeof min !== 'number' || typeof max !== 'number') return null
      return { type: 'range', min, max }
    }
    case 'boolean': {
      return { type: 'boolean' }
    }
    default: {
      return null
    }
  }
}
