import {
  asRecord,
  contentFormat,
  first,
  firstString,
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
    ['subtitle', first(doc, 'subtitle')],
    ['order', first(doc, 'order')],
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
  ['subtitle', first(doc, 'subtitle')],
  ['order', first(doc, 'order')],
  ['format', contentFormat(doc)],
]

const pickSummary = (doc: Record<string, unknown>): string | undefined => {
  const summary = firstString(doc, 'summary', 'subtitle')
  const subtitle = firstString(doc, 'subtitle')
  return summary && summary !== subtitle ? summary : undefined
}

export const pageView: View<unknown> = {
  kind: 'page',
  modes: new Set(['readable', 'llm', 'envelope']),
  readable: (data, ctx) => {
    const doc = normalize(data)
    const content = renderContent(doc)
    const title = firstString(doc, 'title')
    return renderMetadataBlock(
      {
        title: title || undefined,
        kind: 'page',
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
      root: 'mxpage',
      meta: collectEnvelopeMeta(doc),
      content: content.body,
    })
  },
}
