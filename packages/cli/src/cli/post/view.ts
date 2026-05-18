import {
  asRecord,
  contentFormat,
  first,
  firstString,
  formatScalar,
  publishState,
  relationLabel,
  relationSlugOrLabel,
  renderContent,
  unwrapDocument,
} from '../../services/Renderer/content'
import type { View } from '../../services/Renderer/view'
import { frontmatter, renderEnvelope, renderMetadataBlock } from '../render'

const normalize = (data: unknown): Record<string, unknown> =>
  asRecord(unwrapDocument(data))

const collectFields = (
  doc: Record<string, unknown>,
): Array<[string, unknown]> => {
  const fields: Array<[string, unknown]> = [
    ['id', first(doc, 'id')],
    ['slug', first(doc, 'slug')],
    ['state', publishState(doc)],
    ['category', relationLabel(first(doc, 'category'))],
    ['tags', first(doc, 'tags')],
    ['pin', first(doc, 'pin')],
    ['created_at', first(doc, 'created_at', 'createdAt')],
    ['modified_at', first(doc, 'modified_at', 'modifiedAt')],
    ['source_lang', first(doc, 'source_lang', 'sourceLang')],
    ['translated', first(doc, 'is_translated', 'isTranslated')],
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
  ['category', relationSlugOrLabel(first(doc, 'category'))],
  ['state', publishState(doc) === 'published' ? 'publish' : 'draft'],
  ['summary', first(doc, 'summary')],
  ['tags', first(doc, 'tags')],
  ['format', contentFormat(doc)],
]

const pickSummary = (doc: Record<string, unknown>): string | undefined => {
  const summary = firstString(doc, 'summary', 'subtitle')
  const subtitle = firstString(doc, 'subtitle')
  return summary && summary !== subtitle ? summary : undefined
}

export const postView: View<unknown> = {
  kind: 'post',
  modes: new Set(['readable', 'llm', 'envelope']),
  readable: (data, ctx) => {
    const doc = normalize(data)
    const content = renderContent(doc)
    const title = firstString(doc, 'title')
    return renderMetadataBlock(
      {
        title: title || undefined,
        kind: 'post',
        fields: collectFields(doc),
        summary: pickSummary(doc),
        body: content.body || undefined,
        bodyFormat: content.format,
      },
      ctx,
    )
  },
  llm: (data) => {
    const doc = normalize(data)
    const content = renderContent(doc, true)
    const title = firstString(doc, 'title')
    const fm = frontmatter({
      title: title || undefined,
      fields: collectFields(doc),
      summary: pickSummary(doc),
    })
    return content.body ? `${fm}\n\n${content.body}` : fm
  },
  envelope: (data) => {
    const doc = normalize(data)
    const content = renderContent(doc)
    return renderEnvelope({
      root: 'mxpost',
      meta: collectEnvelopeMeta(doc),
      content: content.body,
    })
  },
}

const collectListItemFields = (
  doc: Record<string, unknown>,
): Array<[string, unknown]> => [
  ['id', first(doc, 'id')],
  ['title', first(doc, 'title')],
  ['slug', first(doc, 'slug')],
  ['state', publishState(doc)],
  ['category', relationLabel(first(doc, 'category'))],
  ['tags', first(doc, 'tags')],
  ['summary', first(doc, 'summary')],
  ['created_at', first(doc, 'created_at', 'createdAt')],
  ['modified_at', first(doc, 'modified_at', 'modifiedAt')],
  ['source_lang', first(doc, 'source_lang', 'sourceLang')],
  ['translated', first(doc, 'is_translated', 'isTranslated')],
]

const renderPostListReadable = (data: unknown): string => {
  const payload = asRecord(data)
  const rows = Array.isArray(payload.data)
    ? (payload.data as unknown[])
    : Array.isArray(data)
      ? (data as unknown[])
      : []
  const pagination = asRecord(first(payload, 'pagination'))
  const lines = ['posts']
  if (rows.length > 0) lines.push(`count: ${rows.length}`)
  else lines.push('count: 0')
  const page = first(pagination, 'page', 'currentPage')
  const size = first(pagination, 'size', 'pageSize')
  const total = first(pagination, 'total', 'totalCount')
  if (page !== undefined) lines.push(`page: ${formatScalar(page)}`)
  if (size !== undefined) lines.push(`size: ${formatScalar(size)}`)
  if (total !== undefined) lines.push(`total: ${formatScalar(total)}`)
  rows.forEach((row, index) => {
    const doc = asRecord(row)
    lines.push('', `post ${index + 1}:`)
    const fields = collectListItemFields(doc)
    for (const [key, value] of fields) {
      if (value === undefined || value === null || value === '') continue
      lines.push(`${key}: ${formatScalar(value)}`)
    }
  })
  return lines.join('\n')
}

export const postListView: View<unknown> = {
  kind: 'post-list',
  modes: new Set(['readable', 'llm']),
  readable: (data) => renderPostListReadable(data),
}
