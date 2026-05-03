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
  slug?: string | null
  nid?: number | null
  isPublished?: boolean | null
  publicAt?: Date | null
  password?: string | null
  hasPassword?: boolean
  createdAt?: Date | null
  modifiedAt?: Date | null
}

export function buildSearchDocument(
  refType: SearchDocumentRefType,
  data: SearchDocumentSource,
): Omit<SearchDocumentModel, 'id'> {
  const normalizedTitle = normalizeSearchText(data.title)
  const normalizedBody = normalizeSearchText(
    extractTextFromContent({
      text: data.text ?? '',
      contentFormat: data.contentFormat ?? undefined,
      content: data.content ?? undefined,
    }),
  )
  const titleTerms = tokenizeSearchText(normalizedTitle, {
    includeCjkUnigrams: true,
    maxTokens: 96,
  })
  const bodyTerms = tokenizeSearchText(normalizedBody, {
    includeCjkUnigrams: false,
    maxTokens: 512,
  })
  const titleTermFreq = buildTermFrequency(titleTerms)
  const bodyTermFreq = buildTermFrequency(bodyTerms)

  return {
    refType,
    refId: data.id,
    title: normalizedTitle,
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
    created: data.createdAt ?? new Date(),
    modified: data.modifiedAt ?? null,
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
