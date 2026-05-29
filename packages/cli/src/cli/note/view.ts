import {
  asRecord,
  contentFormat,
  first,
  firstString,
  formatScalar,
  pickArticleTranslationMeta,
  publishState,
  relationLabel,
  relationSlugOrLabel,
  renderContent,
  unwrapDocument,
} from '../../services/Renderer/content'
import { tryFormatTimestamp } from '../../services/Renderer/datetime'
import type { View } from '../../services/Renderer/view'
import { frontmatter, renderEnvelope, renderMetadataBlock } from '../render'

const normalize = (data: unknown): Record<string, unknown> =>
  asRecord(unwrapDocument(data))

const collectFields = (
  doc: Record<string, unknown>,
  articleMeta?: Record<string, unknown>,
): Array<[string, unknown]> => {
  const meta = articleMeta ?? {}
  const fields: Array<[string, unknown]> = [
    ['id', first(doc, 'id')],
    ['slug', first(doc, 'slug')],
    ['nid', first(doc, 'nid')],
    ['state', publishState(doc)],
    ['topic', relationLabel(first(doc, 'topic'))],
    ['mood', first(doc, 'mood')],
    ['weather', first(doc, 'weather')],
    ['public_at', first(doc, 'public_at', 'publicAt')],
    ['bookmark', first(doc, 'bookmark')],
    ['created_at', first(doc, 'created_at', 'createdAt')],
    ['modified_at', first(doc, 'modified_at', 'modifiedAt')],
    [
      'source_lang',
      first(doc, 'source_lang', 'sourceLang') ??
        first(meta, 'source_lang', 'sourceLang'),
    ],
    [
      'translated',
      first(doc, 'is_translated', 'isTranslated') ??
        first(meta, 'is_translated', 'isTranslated'),
    ],
  ]
  return fields.filter(
    ([key, value]) =>
      value !== undefined &&
      value !== null &&
      value !== '' &&
      !(key === 'translated' && value === false),
  )
}

const collectEnvelopeMeta = (
  doc: Record<string, unknown>,
): Array<[string, unknown]> => [
  ['title', first(doc, 'title')],
  ['slug', first(doc, 'slug')],
  ['topic', relationSlugOrLabel(first(doc, 'topic'))],
  ['state', publishState(doc) === 'published' ? 'publish' : 'draft'],
  ['mood', first(doc, 'mood')],
  ['weather', first(doc, 'weather')],
  ['publicAt', first(doc, 'public_at', 'publicAt')],
  ['bookmark', first(doc, 'bookmark')],
  ['location', first(doc, 'location')],
  ['format', contentFormat(doc)],
]

const pickSummary = (doc: Record<string, unknown>): string | undefined => {
  const summary = firstString(doc, 'summary', 'subtitle')
  const subtitle = firstString(doc, 'subtitle')
  return summary && summary !== subtitle ? summary : undefined
}

export const noteView: View<unknown> = {
  kind: 'note',
  modes: new Set(['readable', 'llm', 'xml']),
  readable: (data, ctx) => {
    const doc = normalize(data)
    const articleMeta = pickArticleTranslationMeta(data, first(doc, 'id'))
    const content = renderContent(doc)
    const title = firstString(doc, 'title')
    return renderMetadataBlock(
      {
        title: title || undefined,
        kind: 'note',
        fields: collectFields(doc, articleMeta),
        summary: pickSummary(doc),
        body: content.body || undefined,
        bodyFormat: content.format,
      },
      ctx,
    )
  },
  llm: (data) => {
    const doc = normalize(data)
    const articleMeta = pickArticleTranslationMeta(data, first(doc, 'id'))
    const content = renderContent(doc, true)
    const title = firstString(doc, 'title')
    const fm = frontmatter({
      title: title || undefined,
      fields: collectFields(doc, articleMeta),
      summary: pickSummary(doc),
    })
    return content.body ? `${fm}\n\n${content.body}` : fm
  },
  xml: (data) => {
    const doc = normalize(data)
    const content = renderContent(doc)
    return renderEnvelope({
      root: 'mxnote',
      meta: collectEnvelopeMeta(doc),
      content: content.body,
    })
  },
}

const collectListItemFields = (
  doc: Record<string, unknown>,
  articleMeta?: Record<string, unknown>,
): Array<[string, unknown]> => {
  const meta = articleMeta ?? {}
  return [
    ['id', first(doc, 'id')],
    ['nid', first(doc, 'nid')],
    ['title', first(doc, 'title')],
    ['slug', first(doc, 'slug')],
    ['state', publishState(doc)],
    ['topic', relationLabel(first(doc, 'topic'))],
    ['mood', first(doc, 'mood')],
    ['weather', first(doc, 'weather')],
    ['bookmark', first(doc, 'bookmark')],
    ['summary', first(doc, 'summary')],
    ['public_at', first(doc, 'public_at', 'publicAt')],
    ['created_at', first(doc, 'created_at', 'createdAt')],
    ['modified_at', first(doc, 'modified_at', 'modifiedAt')],
    [
      'source_lang',
      first(doc, 'source_lang', 'sourceLang') ??
        first(meta, 'source_lang', 'sourceLang'),
    ],
    [
      'translated',
      first(doc, 'is_translated', 'isTranslated') ??
        first(meta, 'is_translated', 'isTranslated'),
    ],
  ]
}

const renderNoteListReadable = (data: unknown): string => {
  const payload = asRecord(data)
  const rows = Array.isArray(payload.data)
    ? (payload.data as unknown[])
    : Array.isArray(data)
      ? (data as unknown[])
      : []
  const meta = asRecord(first(payload, 'meta'))
  const pagination = asRecord(first(meta, 'pagination'))
  const lines = ['notes']
  if (rows.length > 0) lines.push(`count: ${rows.length}`)
  else lines.push('count: 0')
  const page = first(pagination, 'page', 'currentPage')
  const size = first(pagination, 'size', 'pageSize')
  const total = first(pagination, 'total', 'totalCount', 'total_count')
  if (page !== undefined) lines.push(`page: ${formatScalar(page)}`)
  if (size !== undefined) lines.push(`size: ${formatScalar(size)}`)
  if (total !== undefined) lines.push(`total: ${formatScalar(total)}`)
  rows.forEach((row, index) => {
    const doc = asRecord(row)
    const articleMeta = pickArticleTranslationMeta(data, first(doc, 'id'))
    lines.push('', `note ${index + 1}:`)
    const fields = collectListItemFields(doc, articleMeta)
    for (const [key, value] of fields) {
      if (value === undefined || value === null || value === '') continue
      if (key === 'translated' && value === false) continue
      const rendered =
        tryFormatTimestamp(value, { style: 'rel' }) ?? formatScalar(value)
      lines.push(`${key}: ${rendered}`)
    }
  })
  return lines.join('\n')
}

export const noteListView: View<unknown> = {
  kind: 'note-list',
  modes: new Set(['readable', 'llm']),
  readable: (data) => renderNoteListReadable(data),
}
