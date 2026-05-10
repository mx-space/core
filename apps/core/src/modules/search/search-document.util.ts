import { createHash } from 'node:crypto'

import removeMdCodeblock from 'remove-md-codeblock'

import { extractTextFromContent } from '~/utils/content.util'

import type {
  SearchDocumentModel,
  SearchDocumentRefType,
} from './search-document.types'

type SearchDocumentSource = {
  id: string
  title?: string | null
  text?: string | null
  contentFormat?: string | null
  content?: string | null
  tags?: string[] | null
  slug?: string | null
  nid?: number | null
  isPublished?: boolean | null
  publicAt?: Date | null
  password?: string | null
  hasPassword?: boolean
  createdAt?: Date | null
  modifiedAt?: Date | null
  sourceHash?: string | null
}

export function buildSearchDocument(
  refType: SearchDocumentRefType,
  data: SearchDocumentSource,
  lang: string,
): Omit<SearchDocumentModel, 'id'> {
  // Preserve the original case for display; tokenization still uses the
  // lowercased form so BM25/match logic is case-insensitive.
  const displayTitle = cleanTitleForDisplay(data.title)
  const lowerTitle = normalizeSearchText(displayTitle)
  const normalizedBody = normalizeSearchText(
    extractTextFromContent({
      text: data.text ?? '',
      contentFormat: data.contentFormat ?? undefined,
      content: data.content ?? undefined,
    }),
  )
  const titleTerms = tokenizeSearchText(lowerTitle, {
    includeCjkUnigrams: true,
    maxTokens: 96,
  })
  const bodyTerms = tokenizeSearchText(normalizedBody, {
    includeCjkUnigrams: false,
    maxTokens: 512,
  })
  const titleTermFreq = buildTermFrequency(titleTerms)
  const bodyTermFreq = buildTermFrequency(bodyTerms)

  const sourceHash =
    data.sourceHash ??
    computeSourceHash({
      title: data.title ?? '',
      text: data.text ?? '',
      content: data.content ?? null,
      contentFormat: data.contentFormat ?? null,
      tags: data.tags ?? [],
    })

  return {
    refType,
    refId: data.id,
    lang,
    sourceHash,
    title: displayTitle,
    searchText: normalizedBody,
    terms: [
      ...new Set([...Object.keys(titleTermFreq), ...Object.keys(bodyTermFreq)]),
    ],
    titleTermFreq,
    bodyTermFreq,
    titleLength: titleTerms.length,
    bodyLength: bodyTerms.length,
    slug: data.slug ?? undefined,
    nid: data.nid ?? undefined,
    isPublished: refType === 'page' ? true : data.isPublished !== false,
    publicAt: data.publicAt ?? null,
    hasPassword: data.hasPassword ?? Boolean(data.password),
    createdAt: data.createdAt ?? new Date(),
    modifiedAt: data.modifiedAt ?? null,
  }
}

export function buildTermFrequency(tokens: string[]) {
  const map: Record<string, number> = {}
  for (const token of tokens) {
    map[token] = (map[token] ?? 0) + 1
  }
  return map
}

export function normalizeSearchText(text: unknown) {
  return removeMdCodeblock(typeof text === 'string' ? text : '')
    .normalize('NFKC')
    .toLowerCase()
    .replaceAll(/\s+/g, ' ')
    .trim()
}

/**
 * Clean a title for display: NFKC + collapse whitespace + trim, but preserve
 * original casing. Markdown stripping is not applied because titles never
 * contain code fences.
 */
export function cleanTitleForDisplay(text: unknown) {
  return (typeof text === 'string' ? text : '')
    .normalize('NFKC')
    .replaceAll(/\s+/g, ' ')
    .trim()
}

export function tokenizeSearchText(
  text: string,
  options: { includeCjkUnigrams: boolean; maxTokens: number },
) {
  if (!text) {
    return []
  }

  const tokens: string[] = []
  const segments = text.match(
    /[\da-z]+|[\u3040-\u30FF\u3400-\u4DBF\u4E00-\u9FFF\uAC00-\uD7AF\uF900-\uFAFF]+/g,
  )

  for (const segment of segments ?? []) {
    if (isCjkSegment(segment)) {
      if (options.includeCjkUnigrams) {
        for (const char of segment) {
          tokens.push(char)
        }
      }
      if (segment.length <= 8) {
        tokens.push(segment)
      }
      for (let index = 0; index < segment.length - 1; index++) {
        tokens.push(segment.slice(index, index + 2))
      }
    } else {
      tokens.push(segment)
    }

    if (tokens.length >= options.maxTokens) {
      break
    }
  }

  return tokens.slice(0, options.maxTokens)
}

function isCjkSegment(input: string) {
  return /[\u3040-\u30FF\u3400-\u4DBF\u4E00-\u9FFF\uAC00-\uD7AF\uF900-\uFAFF]/.test(
    input,
  )
}

/**
 * Stable source hash for an article's content. Used by rebuild diff to skip
 * documents whose source hasn't changed since last index. The hash captures
 * everything that affects the indexed text + tokens.
 */
export function computeSourceHash(parts: {
  title?: string | null
  text?: string | null
  content?: string | null
  contentFormat?: string | null
  tags?: string[] | null
}): string {
  const tagPart = (parts.tags ?? []).slice().sort().join(',')
  const payload = [
    parts.title ?? '',
    parts.text ?? '',
    parts.content ?? '',
    parts.contentFormat ?? '',
    tagPart,
  ].join('\n')
  return createHash('sha1').update(payload).digest('hex')
}

/**
 * Source hash for a translation row. The translation table already stores a
 * `hash` of its source snapshot — wrap it as an explicit accessor so callers
 * don't conflate translation hash with the article's content hash.
 */
export function computeTranslationSourceHash(translation: {
  hash: string
}): string {
  return translation.hash
}

export const SEARCH_DOCUMENT_DEFAULT_SOURCE_LANG = 'zh'
