import { createDefaultRegistry, serializeToXml } from '@haklex/rich-litexml'

export const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}

export const first = (
  record: Record<string, unknown>,
  ...keys: string[]
): unknown => {
  for (const key of keys) {
    if (record[key] !== undefined && record[key] !== null) return record[key]
  }
  return undefined
}

export const firstString = (
  record: Record<string, unknown>,
  ...keys: string[]
): string => {
  const value = first(record, ...keys)
  return typeof value === 'string' ? value : ''
}

export const contentFormat = (doc: Record<string, unknown>): string => {
  const value = first(doc, 'content_format', 'contentFormat')
  return typeof value === 'string' ? value : 'markdown'
}

export const publishState = (
  doc: Record<string, unknown>,
): string | undefined => {
  const value = first(doc, 'is_published', 'isPublished')
  if (typeof value === 'boolean') return value ? 'published' : 'draft'
  return undefined
}

export const relationLabel = (value: unknown): string | undefined => {
  if (!value) return undefined
  if (typeof value === 'string') return value
  const obj = asRecord(value)
  return (
    firstString(obj, 'name') ||
    firstString(obj, 'slug') ||
    firstString(obj, 'id')
  )
}

export const relationSlugOrLabel = (value: unknown): string | undefined => {
  if (!value) return undefined
  if (typeof value === 'string') return value
  const obj = asRecord(value)
  return (
    firstString(obj, 'slug') ||
    firstString(obj, 'name') ||
    firstString(obj, 'id')
  )
}

export const formatScalar = (value: unknown): string => {
  if (Array.isArray(value)) return value.map(formatScalar).join(', ')
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'object' && value !== null) return JSON.stringify(value)
  return String(value)
}

export const escapeXml = (value: string): string =>
  value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')

export const unwrapDocument = (data: unknown): unknown => {
  const obj = asRecord(data)
  const nested = obj.data
  if (nested && typeof nested === 'object' && !Array.isArray(nested))
    return nested
  return data
}

export const pickArticleTranslationMeta = (
  payload: unknown,
  docId: unknown,
): Record<string, unknown> | undefined => {
  const translation = asRecord(asRecord(asRecord(payload).meta).translation)
  if (Object.keys(translation).length === 0) return undefined
  const direct = asRecord(translation.article)
  if (Object.keys(direct).length > 0) return direct
  if (docId === undefined || docId === null) return undefined
  const entry = asRecord(translation[String(docId)])
  const article = asRecord(entry.article)
  return Object.keys(article).length > 0 ? article : undefined
}

// Synchronous Lexical → LiteXML helper kept inline so the Renderer can match
// legacy `document-output.ts` behaviour without depending on the Lexical
// service. The Lexical service still owns Markdown derivation (`--output llm`)
// and stateful round-trips; here we only need the cheap XML serialization.
let cachedRegistry: ReturnType<typeof createDefaultRegistry> | null = null
const getRegistry = () => {
  if (!cachedRegistry) cachedRegistry = createDefaultRegistry()
  return cachedRegistry
}

const stripDocWrapper = (xml: string): string => {
  const trimmed = xml.trim()
  if (trimmed.startsWith('<doc>') && trimmed.endsWith('</doc>')) {
    return trimmed.slice('<doc>'.length, trimmed.length - '</doc>'.length)
  }
  return trimmed
}

export const tryLexicalToLitexml = (jsonStr: string): string | null => {
  try {
    const parsed = JSON.parse(jsonStr) as unknown
    const xml = serializeToXml(parsed as any, getRegistry(), { compact: false })
    return stripDocWrapper(xml).trim()
  } catch {
    return null
  }
}

export const renderContent = (
  doc: Record<string, unknown>,
  llm = false,
): { body: string; format: 'litexml' | 'markdown' | 'text' } => {
  const format = contentFormat(doc)
  const content = firstString(doc, 'content')
  const text = firstString(doc, 'text')
  if (format === 'lexical' && content) {
    // For LLM consumers, prefer the plain `text` field over litexml — easier
    // to parse and free of markup boilerplate.
    if (llm) {
      if (text) return { body: text, format: 'text' }
      const xml = tryLexicalToLitexml(content)
      return xml !== null
        ? { body: xml, format: 'litexml' }
        : { body: content, format: 'text' }
    }
    const xml = tryLexicalToLitexml(content)
    if (xml !== null) return { body: xml, format: 'litexml' }
    return { body: text || content, format: text ? 'text' : 'markdown' }
  }
  return {
    body: content || text || '',
    format: format === 'markdown' ? 'markdown' : 'text',
  }
}
