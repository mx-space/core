import {
  asRecord,
  contentFormat,
  first,
  firstString,
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
    ['nid', first(doc, 'nid')],
    ['state', publishState(doc)],
    ['topic', relationLabel(first(doc, 'topic'))],
    ['mood', first(doc, 'mood')],
    ['weather', first(doc, 'weather')],
    ['public_at', first(doc, 'public_at', 'publicAt')],
    ['bookmark', first(doc, 'bookmark')],
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
  modes: new Set(['readable', 'llm', 'envelope']),
  readable: (data, ctx) => {
    const doc = normalize(data)
    const content = renderContent(doc)
    const title = firstString(doc, 'title')
    return renderMetadataBlock(
      {
        title: title || undefined,
        kind: 'note',
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
      root: 'mxnote',
      meta: collectEnvelopeMeta(doc),
      content: content.body,
    })
  },
}
