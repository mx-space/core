import { parseHTML } from 'linkedom'

import type { EnrichmentResult } from '../../enrichment.types'
import { ENRICHMENT_CATEGORIES } from '../provider.constants'

export interface ParsedMeta {
  result: EnrichmentResult
  /**
   * URL of an `application/json+oembed` alternate, if the page advertises one.
   * Caller may follow it to enrich title/thumbnail; v1 does not require it.
   */
  oembedUrl?: string
}

interface MetaBag {
  og: Record<string, string>
  twitter: Record<string, string>
  named: Record<string, string>
  title?: string
  canonical?: string
  icons: { href: string; rel: string; sizes?: string }[]
  oembedUrl?: string
}

/**
 * Parse HTML head into an EnrichmentResult. `requestUrl` is the URL the
 * fetcher landed on (after redirects); `originalUrl` is what the user
 * actually pasted, used as the cache key surface.
 */
export function parseOpenGraph(
  html: string,
  requestUrl: string,
  originalUrl: string,
): ParsedMeta {
  const { document } = parseHTML(`<!doctype html>${html}`)
  const bag = collectMeta(document)

  const title =
    pick(bag.og, 'title') ||
    pick(bag.twitter, 'title') ||
    bag.title ||
    fallbackTitleFromUrl(originalUrl)

  const description =
    pick(bag.og, 'description') ||
    pick(bag.twitter, 'description') ||
    pick(bag.named, 'description') ||
    undefined

  const imageUrl = resolveImage(bag, requestUrl)
  const imageAlt =
    pick(bag.og, 'image:alt') || pick(bag.twitter, 'image:alt') || undefined

  const canonicalRaw =
    pick(bag.og, 'url') || bag.canonical || requestUrl || originalUrl
  const canonical = absolutize(canonicalRaw, requestUrl) || originalUrl

  const ogType = pick(bag.og, 'type')
  const subtype = mapOgTypeToSubtype(ogType)

  const siteName =
    pick(bag.og, 'site_name') || pick(bag.twitter, 'site') || undefined
  const ogLocale = pick(bag.og, 'locale')
  const author =
    pick(bag.named, 'author') ||
    pick(bag.og, 'article:author') ||
    pick(bag.twitter, 'creator')
  const publishedAt = normalizeDate(pick(bag.og, 'article:published_time'))
  const section = pick(bag.og, 'article:section')
  const tagsRaw = pick(bag.og, 'article:tag')
  const themeColor = pick(bag.named, 'theme-color')

  const attributes: NonNullable<EnrichmentResult['attributes']> = []
  if (siteName)
    attributes.push({
      key: 'site',
      value: siteName,
      label: 'Site',
      format: 'text',
    })
  if (ogLocale)
    attributes.push({
      key: 'locale',
      value: ogLocale,
      label: 'Locale',
      format: 'text',
    })
  if (author)
    attributes.push({
      key: 'author',
      value: author,
      label: 'Author',
      format: 'text',
    })
  if (section)
    attributes.push({
      key: 'section',
      value: section,
      label: 'Section',
      format: 'text',
    })
  if (tagsRaw)
    attributes.push({
      key: 'tags',
      value: tagsRaw,
      label: 'Tags',
      format: 'text',
    })
  if (ogType && !subtype)
    attributes.push({
      key: 'og_type',
      value: ogType,
      label: 'Type',
      format: 'text',
    })

  const result: EnrichmentResult = {
    title,
    description,
    image: imageUrl ? { url: imageUrl, alt: imageAlt } : undefined,
    url: canonical,
    category: ENRICHMENT_CATEGORIES.WEB,
    subtype,
    fetchedAt: '',
    publishedAt,
    color: themeColor,
    attributes: attributes.length ? attributes : undefined,
  }

  return { result, oembedUrl: bag.oembedUrl }
}

function collectMeta(document: Document): MetaBag {
  const bag: MetaBag = {
    og: Object.create(null),
    twitter: Object.create(null),
    named: Object.create(null),
    icons: [],
  }

  for (const meta of document.querySelectorAll('meta')) {
    const property = (meta.getAttribute('property') || '').toLowerCase().trim()
    const name = (meta.getAttribute('name') || '').toLowerCase().trim()
    const content = meta.getAttribute('content')
    if (!content) continue
    const value = content.trim()
    if (!value) continue

    if (property.startsWith('og:')) {
      bag.og[property.slice(3)] ??= value
    } else if (property.startsWith('article:')) {
      bag.og[property] ??= value
    } else if (name.startsWith('twitter:')) {
      bag.twitter[name.slice(8)] ??= value
    } else if (name) {
      bag.named[name] ??= value
    }
  }

  const titleEl = document.querySelector('title')
  if (titleEl?.textContent) bag.title = titleEl.textContent.trim() || undefined

  for (const link of document.querySelectorAll('link')) {
    const rel = (link.getAttribute('rel') || '').toLowerCase().trim()
    const href = link.getAttribute('href')
    if (!rel || !href) continue
    if (rel === 'canonical') {
      bag.canonical ??= href.trim()
    } else if (
      rel === 'icon' ||
      rel === 'shortcut icon' ||
      rel === 'apple-touch-icon' ||
      rel === 'apple-touch-icon-precomposed'
    ) {
      bag.icons.push({
        href: href.trim(),
        rel,
        sizes: link.getAttribute('sizes') || undefined,
      })
    } else if (rel === 'alternate') {
      const type = (link.getAttribute('type') || '').toLowerCase()
      if (type === 'application/json+oembed' || type === 'text/xml+oembed') {
        bag.oembedUrl ??= href.trim()
      }
    }
  }

  return bag
}

function pick(map: Record<string, string>, key: string): string | undefined {
  const v = map[key.toLowerCase()]
  return v && v.length > 0 ? v : undefined
}

function resolveImage(bag: MetaBag, base: string): string | undefined {
  const candidates = [
    pick(bag.og, 'image:secure_url'),
    pick(bag.og, 'image:url'),
    pick(bag.og, 'image'),
    pick(bag.twitter, 'image:src'),
    pick(bag.twitter, 'image'),
  ]
  for (const c of candidates) {
    const abs = absolutize(c, base)
    if (abs) return abs
  }
  // Fallback: best-sized icon (apple-touch-icon prefers, else first).
  const apple = bag.icons.find((i) => i.rel.startsWith('apple-touch-icon'))
  if (apple) {
    const abs = absolutize(apple.href, base)
    if (abs) return abs
  }
  if (bag.icons.length) {
    const abs = absolutize(bag.icons[0].href, base)
    if (abs) return abs
  }
  return undefined
}

function absolutize(
  value: string | undefined,
  base: string,
): string | undefined {
  if (!value) return undefined
  try {
    return new URL(value, base).toString()
  } catch {
    return undefined
  }
}

function mapOgTypeToSubtype(type: string | undefined): string | undefined {
  if (!type) return undefined
  // Take primary segment ('article', 'video', 'music.song' → 'music', etc.).
  const primary = type.split('.')[0].split(':')[0].toLowerCase()
  switch (primary) {
    case 'article':
    case 'website':
    case 'video':
    case 'music':
    case 'book':
    case 'profile': {
      return primary
    }
    default: {
      return undefined
    }
  }
}

function normalizeDate(input: string | undefined): string | undefined {
  if (!input) return undefined
  const d = new Date(input)
  if (Number.isNaN(d.getTime())) return undefined
  return d.toISOString()
}

function fallbackTitleFromUrl(url: string): string {
  try {
    const u = new URL(url)
    return u.hostname + (u.pathname && u.pathname !== '/' ? u.pathname : '')
  } catch {
    return url
  }
}
