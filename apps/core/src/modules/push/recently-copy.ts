import { compact, isPlainObject, isString, pickBy } from 'es-toolkit/compat'

import type { EnrichmentResult } from '../enrichment/enrichment.types'

export type EnrichmentMap = Record<string, EnrichmentResult>

export type ThinkingVerb =
  'watched' | 'read' | 'listened' | 'studied' | 'linked'

export type ThinkingFactType = 'tv' | 'movie' | 'book' | 'album' | 'song'

export type ThinkingCopy =
  | { kind: 'skip' }
  | {
      kind: 'enriched'
      verb: ThinkingVerb
      work_title: string
      description?: string
      fact_creator?: string
      fact_year?: string
      fact_type?: ThinkingFactType
    }
  | { kind: 'plain'; text: string; summary?: string }

const FACT_TYPES = ['tv', 'movie', 'book', 'album', 'song'] as const

const pickVerb = (enrichment: EnrichmentResult): ThinkingVerb => {
  const category = enrichment.category ?? ''
  const subtype = enrichment.subtype ?? ''
  if (category === 'media') {
    if (subtype === 'movie' || subtype === 'tv') return 'watched'
    if (subtype === 'book') return 'read'
    if (subtype === 'music' || subtype === 'album' || subtype === 'song')
      return 'listened'
  }
  if (category === 'book') return 'read'
  if (category === 'music') return 'listened'
  if (category === 'academic') return 'studied'
  return 'linked'
}

const isHttpUrl = (raw: string) => {
  try {
    const protocol = new URL(raw).protocol
    return protocol === 'http:' || protocol === 'https:'
  } catch {
    return false
  }
}

const clip = (value: string, max: number) =>
  value.trim().slice(0, max) || undefined

const factsOf = (enrichment: EnrichmentResult) => {
  const creator = enrichment.attributes?.find(
    (attribute) =>
      (attribute.key === 'author' || attribute.key === 'artist') &&
      isString(attribute.value) &&
      attribute.value.trim(),
  )?.value
  const fact_creator = isString(creator) ? clip(creator, 80) : undefined
  const fact_year = enrichment.publishedAt?.match(/^(\d{4})/)?.[1]
  const fact_type = FACT_TYPES.find((type) => type === enrichment.subtype)
  return pickBy(
    fact_creator
      ? { fact_creator, fact_year }
      : fact_type && fact_year
        ? { fact_type, fact_year }
        : {},
    Boolean,
  ) as Pick<
    Extract<ThinkingCopy, { kind: 'enriched' }>,
    'fact_creator' | 'fact_year' | 'fact_type'
  >
}

const resolveLink = (
  candidate: string,
  enrichments: EnrichmentMap | undefined,
) => {
  if (!isHttpUrl(candidate)) return null
  const enrichment = enrichments?.[candidate]
  if (!enrichment?.title || !enrichment.url) return null
  const work_title = clip(enrichment.title, 160)
  if (!work_title) return null
  return {
    verb: pickVerb(enrichment),
    work_title,
    ...factsOf(enrichment),
  }
}

export const projectThinkingCopy = (
  content: string,
  enrichments?: EnrichmentMap,
): ThinkingCopy => {
  const trimmed = content.trim()
  if (!trimmed) return { kind: 'skip' }

  const whole = resolveLink(trimmed, enrichments)
  if (whole) return { kind: 'enriched', ...whole }

  const paragraphs = compact(trimmed.split(/\n\s*\n/).map((p) => p.trim()))
  if (paragraphs.length >= 2) {
    const index = paragraphs.findIndex((paragraph) =>
      resolveLink(paragraph, enrichments),
    )
    if (index >= 0) {
      const link = resolveLink(paragraphs[index]!, enrichments)!
      const description = clip(
        paragraphs.filter((_, i) => i !== index).join('\n\n'),
        360,
      )
      return {
        kind: 'enriched',
        ...link,
        ...(description ? { description } : {}),
      }
    }
  }

  if (isHttpUrl(trimmed) && paragraphs.length <= 1) return { kind: 'skip' }

  const [first, ...rest] = paragraphs
  const text = clip(first ?? '', 160)
  if (!text) return { kind: 'skip' }
  const summary = clip(rest.join('\n\n'), 360)
  return { kind: 'plain', text, ...(summary ? { summary } : {}) }
}

export const enrichmentMapOf = (value: unknown): EnrichmentMap | undefined =>
  isPlainObject(value) ? (value as EnrichmentMap) : undefined
