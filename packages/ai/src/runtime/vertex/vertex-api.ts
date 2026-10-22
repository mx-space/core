export const VERTEX_MEDIA_LOCATION = 'us-central1'

export interface VertexConnectionConfig {
  endpoint?: string
  projectId?: string
}

export function resolveVertexProjectId(config: VertexConnectionConfig): string {
  const explicit = config.projectId?.trim()
  if (explicit) return explicit

  const endpoint = config.endpoint?.trim()
  if (endpoint) {
    try {
      const match = new URL(endpoint).pathname.match(/\/projects\/([^/]+)/)
      if (match?.[1]) return decodeURIComponent(match[1])
    } catch {
      // The caller receives the provider-specific missing-project error below.
    }
  }

  throw new Error('Google Vertex AI requires a Google Cloud project ID')
}

export function buildVertexPublisherModelUrl(input: {
  config: VertexConnectionConfig
  location?: string
  method: 'generateContent' | 'predict'
  model: string
  version: 'v1' | 'v1beta1'
}): string {
  const projectId = encodeURIComponent(resolveVertexProjectId(input.config))
  const location = encodeURIComponent(
    input.location?.trim() || VERTEX_MEDIA_LOCATION,
  )
  const model = encodeURIComponent(input.model.replace(/^google\//, '').trim())
  const host =
    input.method === 'predict'
      ? `https://${location}-aiplatform.googleapis.com`
      : 'https://aiplatform.googleapis.com'

  return `${host}/${input.version}/projects/${projectId}/locations/${location}/publishers/google/models/${model}:${input.method}`
}

export function getVertexHeaders(apiKey: string): Record<string, string> {
  return {
    'content-type': 'application/json',
    'x-goog-api-key': apiKey,
  }
}

export async function readVertexError(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as {
      error?: { message?: unknown }
    }
    if (typeof payload.error?.message === 'string') {
      return payload.error.message.slice(0, 300)
    }
  } catch {
    // Preserve the HTTP status when the response is not JSON.
  }
  return `HTTP ${response.status}`
}
