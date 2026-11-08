import type { ImageContent, Message, TextContent } from '@earendil-works/pi-ai'
import sharp from 'sharp'

export interface AgentToolImage {
  url: string
  mimeType?: string
}

export interface LoadedImage {
  data: string
  mimeType: string
}

export type ImageLoader = (url: string) => Promise<LoadedImage | null>

const MAX_EDGE = 1568
const DEFAULT_MAX_BYTES = 20 * 1024 * 1024
const FETCH_TIMEOUT_MS = 15_000

const isRemoteReference = (data: string) => /^https?:\/\//.test(data)

// Transcripts keep the URL in the image block's data field so history never
// stores base64; hydrateImages swaps it for bytes right before a model call.
export function toolResultContent(
  text: string,
  images: AgentToolImage[] = [],
): (TextContent | ImageContent)[] {
  return [
    { type: 'text', text },
    ...images.map((image): ImageContent => ({
      type: 'image',
      data: image.url,
      mimeType: image.mimeType ?? 'image/png',
    })),
  ]
}

export function userContent(
  text: string,
  images: AgentToolImage[] = [],
): string | (TextContent | ImageContent)[] {
  return images.length ? toolResultContent(text, images) : text
}

export async function hydrateImages(
  messages: Message[],
  load: ImageLoader,
): Promise<Message[]> {
  const cache = new Map<string, Promise<LoadedImage | null>>()
  const resolve = (url: string) => {
    let pending = cache.get(url)
    if (!pending) {
      pending = load(url).catch(() => null)
      cache.set(url, pending)
    }
    return pending
  }

  return Promise.all(
    messages.map(async (message) => {
      if (message.role !== 'toolResult' && message.role !== 'user')
        return message
      if (
        typeof message.content === 'string' ||
        !message.content.some(
          (block) => block.type === 'image' && isRemoteReference(block.data),
        )
      )
        return message
      const content = await Promise.all(
        message.content.map(async (block) => {
          if (block.type !== 'image' || !isRemoteReference(block.data))
            return block
          const loaded = await resolve(block.data)
          return loaded
            ? ({ type: 'image', ...loaded } satisfies ImageContent)
            : ({
                type: 'text',
                text: `[image unavailable: ${block.data}]`,
              } satisfies TextContent)
        }),
      )
      return { ...message, content } as Message
    }),
  )
}

export function createImageLoader(options: {
  allowedHosts: string[]
  fetch?: typeof fetch
  maxBytes?: number
}): ImageLoader {
  const hosts = new Set(options.allowedHosts.map((host) => host.toLowerCase()))
  const fetchImpl = options.fetch ?? fetch
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES

  return async (url) => {
    let parsed: URL
    try {
      parsed = new URL(url)
    } catch {
      return null
    }
    if (!['http:', 'https:'].includes(parsed.protocol)) return null
    if (!hosts.has(parsed.host.toLowerCase())) return null

    const response = await fetchImpl(parsed, {
      redirect: 'error',
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    })
    if (!response.ok) return null
    const contentType = response.headers.get('content-type') ?? ''
    if (!contentType.startsWith('image/')) return null
    const declared = Number(response.headers.get('content-length') ?? 0)
    if (declared > maxBytes) return null
    const bytes = Buffer.from(await response.arrayBuffer())
    if (bytes.byteLength > maxBytes) return null

    const image = sharp(bytes, { animated: false })
    const { format } = await image.metadata()
    const keepPng = format === 'png'
    const resized = image.resize({
      width: MAX_EDGE,
      height: MAX_EDGE,
      fit: 'inside',
      withoutEnlargement: true,
    })
    const output = await (keepPng ? resized.png() : resized.jpeg()).toBuffer()
    return {
      data: output.toString('base64'),
      mimeType: keepPng ? 'image/png' : 'image/jpeg',
    }
  }
}
