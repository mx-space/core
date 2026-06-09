import {
  asRecord,
  first,
  firstString,
  formatScalar,
  unwrapDocument,
} from '../../services/Renderer/content'
import { tryFormatTimestamp } from '../../services/Renderer/datetime'
import type { View } from '../../services/Renderer/view'
import { frontmatter, renderMetadataBlock } from '../render'

const normalize = (data: unknown): Record<string, unknown> =>
  asRecord(unwrapDocument(data))

const collectFields = (
  doc: Record<string, unknown>,
): Array<[string, unknown]> => {
  const images = first(doc, 'images')
  const imagesField = Array.isArray(images)
    ? images.length === 0
      ? undefined
      : images.length <= 3
        ? images.join(', ')
        : `${images.slice(0, 3).join(', ')} (+${images.length - 3} more)`
    : undefined
  return [
    ['id', first(doc, 'id')],
    ['name', first(doc, 'name')],
    ['preview_url', first(doc, 'preview_url', 'previewUrl')],
    ['project_url', first(doc, 'project_url', 'projectUrl')],
    ['doc_url', first(doc, 'doc_url', 'docUrl')],
    ['avatar', first(doc, 'avatar')],
    ['images', imagesField],
    ['created_at', first(doc, 'created_at', 'createdAt')],
  ].filter(
    ([, value]) => value !== undefined && value !== null && value !== '',
  ) as Array<[string, unknown]>
}

const pickDescription = (doc: Record<string, unknown>): string | undefined => {
  const desc = firstString(doc, 'description')
  return desc || undefined
}

const pickText = (
  doc: Record<string, unknown>,
): { body: string; format: 'text' } | undefined => {
  const text = firstString(doc, 'text')
  return text ? { body: text, format: 'text' } : undefined
}

export const projectView: View<unknown> = {
  kind: 'project',
  modes: new Set(['readable', 'llm']),
  readable: (data, ctx) => {
    const doc = normalize(data)
    const body = pickText(doc)
    const name = firstString(doc, 'name')
    return renderMetadataBlock(
      {
        title: name || undefined,
        kind: 'project',
        fields: collectFields(doc),
        summary: pickDescription(doc),
        body: body?.body,
        bodyFormat: body?.format,
      },
      ctx,
    )
  },
  llm: (data) => {
    const doc = normalize(data)
    const body = pickText(doc)
    const name = firstString(doc, 'name')
    const fm = frontmatter({
      title: name || undefined,
      fields: collectFields(doc),
      summary: pickDescription(doc),
    })
    return body?.body ? `${fm}\n\n${body.body}` : fm
  },
}

const collectListItemFields = (
  doc: Record<string, unknown>,
): Array<[string, unknown]> => [
  ['id', first(doc, 'id')],
  ['name', first(doc, 'name')],
  ['description', first(doc, 'description')],
  ['created_at', first(doc, 'created_at', 'createdAt')],
]

const renderProjectListReadable = (data: unknown): string => {
  const payload = asRecord(data)
  const rows = Array.isArray(payload.data)
    ? (payload.data as unknown[])
    : Array.isArray(data)
      ? (data as unknown[])
      : []
  const meta = asRecord(first(payload, 'meta'))
  const pagination = asRecord(first(meta, 'pagination'))
  const lines = ['projects', `count: ${rows.length}`]
  const page = first(pagination, 'page', 'currentPage')
  const size = first(pagination, 'size', 'pageSize')
  const total = first(pagination, 'total', 'totalCount', 'total_count')
  if (page !== undefined) lines.push(`page: ${formatScalar(page)}`)
  if (size !== undefined) lines.push(`size: ${formatScalar(size)}`)
  if (total !== undefined) lines.push(`total: ${formatScalar(total)}`)
  rows.forEach((row, index) => {
    const doc = asRecord(row)
    lines.push('', `project ${index + 1}:`)
    for (const [key, value] of collectListItemFields(doc)) {
      if (value === undefined || value === null || value === '') continue
      const rendered =
        tryFormatTimestamp(value, { style: 'rel' }) ?? formatScalar(value)
      lines.push(`${key}: ${rendered}`)
    }
  })
  return lines.join('\n')
}

export const projectListView: View<unknown> = {
  kind: 'project-list',
  modes: new Set(['readable', 'llm']),
  readable: (data) => renderProjectListReadable(data),
}
