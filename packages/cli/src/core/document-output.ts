import { MxsError } from './errors'
import { serializeFromLexical, type LexicalState } from './litexml-codec'
import { emitSuccess, type OutputOptions } from './output'

export type DocumentKind = 'post' | 'note' | 'page'

const DOCUMENT_OUTPUT_MODES = new Set([
  'pretty-json',
  'json',
  'readable',
  'llm',
  'envelope',
])

export function emitDocument(
  kind: DocumentKind,
  data: unknown,
  opts: OutputOptions,
): void {
  const mode = opts.output ?? 'pretty-json'
  if (!DOCUMENT_OUTPUT_MODES.has(mode)) {
    throw new MxsError({
      code: 'validation.failed',
      message: `unsupported --output value: ${mode}`,
      hint: 'use --output pretty-json, json, readable, llm, or envelope',
    })
  }

  if (opts.json || mode === 'json' || mode === 'pretty-json') {
    emitSuccess(data, opts)
    return
  }

  const doc = unwrapDocument(data)
  const rendered =
    mode === 'envelope'
      ? renderDocumentEnvelope(kind, doc)
      : renderReadableDocument(kind, doc)
  process.stdout.write(`${rendered}\n`)
}

export function renderReadableDocument(
  kind: DocumentKind,
  data: unknown,
): string {
  const doc = asRecord(data)
  const lines: string[] = [kind]
  const fields = collectReadableFields(kind, doc)

  for (const [key, value] of fields) {
    if (value === undefined || value === null || value === '') continue
    lines.push(`${key}: ${formatScalar(value)}`)
  }

  const summary = firstString(doc, 'summary', 'subtitle')
  if (summary) {
    lines.push('', 'summary:', summary)
  }

  const content = renderContent(doc)
  if (content.body) {
    lines.push(
      '',
      `content_format: ${content.format}`,
      '',
      'content:',
      content.body,
    )
  }

  return lines.join('\n')
}

export function renderDocumentEnvelope(
  kind: DocumentKind,
  data: unknown,
): string {
  const doc = asRecord(data)
  const root = kind === 'note' ? 'mxnote' : 'mxpost'
  const meta = collectEnvelopeMeta(kind, doc)
  const metaLines = meta.map(([key, value]) => renderEnvelopeMeta(key, value))
  const content = renderContent(doc)

  return `<${root}>
  <meta>
${metaLines.join('\n')}
  </meta>
  <content>
${content.body}
  </content>
</${root}>`
}

function collectReadableFields(
  kind: DocumentKind,
  doc: Record<string, unknown>,
): Array<[string, unknown]> {
  const base: Array<[string, unknown]> = [
    ['id', first(doc, 'id')],
    ['title', first(doc, 'title')],
    ['slug', first(doc, 'slug')],
  ]

  if (kind === 'post') {
    base.push(
      ['state', publishState(doc)],
      ['category', relationLabel(first(doc, 'category'))],
      ['tags', first(doc, 'tags')],
      ['pin', first(doc, 'pin')],
    )
  } else if (kind === 'note') {
    base.push(
      ['nid', first(doc, 'nid')],
      ['state', publishState(doc)],
      ['topic', relationLabel(first(doc, 'topic'))],
      ['mood', first(doc, 'mood')],
      ['weather', first(doc, 'weather')],
      ['public_at', first(doc, 'public_at', 'publicAt')],
      ['bookmark', first(doc, 'bookmark')],
    )
  } else {
    base.push(
      ['subtitle', first(doc, 'subtitle')],
      ['order', first(doc, 'order')],
    )
  }

  base.push(
    ['created_at', first(doc, 'created_at', 'createdAt')],
    ['modified_at', first(doc, 'modified_at', 'modifiedAt')],
    ['source_lang', first(doc, 'source_lang', 'sourceLang')],
    ['translated', first(doc, 'is_translated', 'isTranslated')],
  )

  return base
}

function collectEnvelopeMeta(
  kind: DocumentKind,
  doc: Record<string, unknown>,
): Array<[string, unknown]> {
  const meta: Array<[string, unknown]> = [
    ['title', first(doc, 'title')],
    ['slug', first(doc, 'slug')],
  ]

  if (kind === 'post') {
    meta.push(
      ['category', relationSlugOrLabel(first(doc, 'category'))],
      ['state', publishState(doc) === 'published' ? 'publish' : 'draft'],
      ['summary', first(doc, 'summary')],
      ['tags', first(doc, 'tags')],
    )
  } else if (kind === 'note') {
    meta.push(
      ['topic', relationSlugOrLabel(first(doc, 'topic'))],
      ['state', publishState(doc) === 'published' ? 'publish' : 'draft'],
      ['mood', first(doc, 'mood')],
      ['weather', first(doc, 'weather')],
      ['publicAt', first(doc, 'public_at', 'publicAt')],
      ['bookmark', first(doc, 'bookmark')],
      ['location', first(doc, 'location')],
    )
  } else {
    meta.push(
      ['subtitle', first(doc, 'subtitle')],
      ['order', first(doc, 'order')],
    )
  }

  meta.push(['format', contentFormat(doc)])
  return meta.filter(
    ([, value]) => value !== undefined && value !== null && value !== '',
  )
}

function renderContent(doc: Record<string, unknown>): {
  body: string
  format: 'litexml' | 'markdown' | 'text'
} {
  const format = contentFormat(doc)
  const content = firstString(doc, 'content')
  const text = firstString(doc, 'text')

  if (format === 'lexical' && content) {
    try {
      return {
        body: serializeFromLexical(JSON.parse(content) as LexicalState),
        format: 'litexml',
      }
    } catch {
      return { body: text || content, format: text ? 'text' : 'markdown' }
    }
  }

  return {
    body: content || text || '',
    format: format === 'markdown' ? 'markdown' : 'text',
  }
}

function unwrapDocument(data: unknown): unknown {
  const obj = asRecord(data)
  const nested = obj.data
  if (nested && typeof nested === 'object' && !Array.isArray(nested))
    return nested
  return data
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function first(record: Record<string, unknown>, ...keys: string[]): unknown {
  for (const key of keys) {
    if (record[key] !== undefined && record[key] !== null) return record[key]
  }
  return undefined
}

function firstString(
  record: Record<string, unknown>,
  ...keys: string[]
): string {
  const value = first(record, ...keys)
  return typeof value === 'string' ? value : ''
}

function contentFormat(doc: Record<string, unknown>): string {
  const value = first(doc, 'content_format', 'contentFormat')
  return typeof value === 'string' ? value : 'markdown'
}

function publishState(doc: Record<string, unknown>): string | undefined {
  const value = first(doc, 'is_published', 'isPublished')
  if (typeof value === 'boolean') return value ? 'published' : 'draft'
  return undefined
}

function relationLabel(value: unknown): string | undefined {
  if (!value) return undefined
  if (typeof value === 'string') return value
  const obj = asRecord(value)
  return (
    firstString(obj, 'name') ||
    firstString(obj, 'slug') ||
    firstString(obj, 'id')
  )
}

function relationSlugOrLabel(value: unknown): string | undefined {
  if (!value) return undefined
  if (typeof value === 'string') return value
  const obj = asRecord(value)
  return (
    firstString(obj, 'slug') ||
    firstString(obj, 'name') ||
    firstString(obj, 'id')
  )
}

function formatScalar(value: unknown): string {
  if (Array.isArray(value)) return value.map(formatScalar).join(', ')
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'object' && value !== null) return JSON.stringify(value)
  return String(value)
}

function renderEnvelopeMeta(key: string, value: unknown): string {
  if (key === 'tags' && Array.isArray(value)) {
    const tags = value
      .map((item) => `      <tag>${escapeXml(formatScalar(item))}</tag>`)
      .join('\n')
    return `    <tags>\n${tags}\n    </tags>`
  }

  return `    <${key}>${escapeXml(formatScalar(value))}</${key}>`
}

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}
