import type { EnrichmentResult } from '../../enrichment.types'
import { safeFetch } from './safe-fetch'

interface OEmbedJson {
  type?: string
  title?: string
  author_name?: string
  author_url?: string
  provider_name?: string
  provider_url?: string
  thumbnail_url?: string
  thumbnail_width?: number
  thumbnail_height?: number
  width?: number
  height?: number
  html?: string
}

/**
 * Best-effort oEmbed enrichment. Pulls JSON from a provider-advertised
 * `application/json+oembed` alternate URL (discovered during HTML parse) and
 * fills gaps in the EnrichmentResult — never overwrites existing fields, so
 * Open Graph remains the source of truth when both are present. XML oEmbed
 * is intentionally not supported; modern providers ship JSON.
 *
 * Errors are swallowed: oEmbed is a bonus, not a requirement.
 */
export async function enrichWithOEmbed(
  result: EnrichmentResult,
  oembedUrl: string,
  opts: { timeoutMs: number; maxBodyBytes: number },
): Promise<void> {
  let parsed: OEmbedJson
  try {
    const { body } = await safeFetch(oembedUrl, {
      timeoutMs: opts.timeoutMs,
      maxBodyBytes: Math.min(opts.maxBodyBytes, 65_536),
      acceptContentTypes: ['application/json', 'text/javascript'],
    })
    parsed = JSON.parse(body) as OEmbedJson
  } catch {
    // Network, parse, content-type — all non-fatal for fallback enrichment.
    return
  }

  if (!result.title && parsed.title) result.title = parsed.title

  if (!result.image?.url && parsed.thumbnail_url) {
    result.image = {
      url: parsed.thumbnail_url,
      width: parsed.thumbnail_width,
      height: parsed.thumbnail_height,
    }
  }

  const attrs = result.attributes ?? []
  const has = (key: string) => attrs.some((a) => a.key === key)
  if (parsed.author_name && !has('author')) {
    attrs.push({
      key: 'author',
      value: parsed.author_name,
      label: 'Author',
      format: 'text',
    })
  }
  if (parsed.provider_name && !has('site')) {
    attrs.push({
      key: 'site',
      value: parsed.provider_name,
      label: 'Site',
      format: 'text',
    })
  }
  if (parsed.type && !result.subtype && isEmbedSubtype(parsed.type)) {
    result.subtype = parsed.type
  }
  if (attrs.length) result.attributes = attrs
}

function isEmbedSubtype(type: string): boolean {
  return (
    type === 'video' || type === 'photo' || type === 'rich' || type === 'link'
  )
}
