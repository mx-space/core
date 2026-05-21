import { stateCodeToName } from '../../services/Comment'
import {
  asRecord,
  first,
  firstString,
  formatScalar,
  unwrapDocument,
} from '../../services/Renderer/content'
import { tryFormatTimestamp } from '../../services/Renderer/datetime'
import type { View } from '../../services/Renderer/view'
import {
  ANSI,
  formatStateBadge,
  frontmatter,
  renderMarkdownToAnsi,
  renderMetadataBlock,
  SEPARATOR_WIDTH,
  visibleLen,
  wrap,
} from '../render'

// ---------------------------------------------------------------------------
// Field helpers (shared by single + list views)
// ---------------------------------------------------------------------------

const normalize = (data: unknown): Record<string, unknown> =>
  asRecord(unwrapDocument(data))

const stateLabel = (raw: unknown): string => {
  if (typeof raw === 'number') return stateCodeToName(raw) ?? String(raw)
  if (typeof raw === 'string') return raw
  return ''
}

const colorForCommentState = (
  raw: unknown,
  color: boolean,
): string | undefined => {
  const label = stateLabel(raw)
  if (!label) return undefined
  if (label === 'unread') return wrap(ANSI.yellow, label, color)
  if (label === 'read') return wrap(ANSI.green, label, color)
  if (label === 'junk') return wrap(ANSI.red, label, color)
  return formatStateBadge(label, color) ?? label
}

const truncate = (s: string, max = 80): string =>
  s.length > max ? `${s.slice(0, max - 1)}…` : s

const oneLine = (s: string): string => s.replaceAll(/\s+/g, ' ').trim()

const authorOf = (doc: Record<string, unknown>): string => {
  const reader = asRecord(first(doc, 'reader'))
  if (Object.keys(reader).length > 0) {
    const name = firstString(reader, 'nickname', 'name')
    if (name) return name
  }
  return firstString(doc, 'author') || '(anonymous)'
}

const refLabel = (doc: Record<string, unknown>): string => {
  const refType = firstString(doc, 'ref_type', 'refType')
  const ref = asRecord(first(doc, 'ref'))
  const title = firstString(ref, 'title', 'slug', 'id')
  if (refType && title) return `${refType}:${title}`
  if (refType) return refType
  return ''
}

const collectDetailFields = (
  doc: Record<string, unknown>,
): Array<[string, unknown]> => {
  const fields: Array<[string, unknown]> = [
    ['id', first(doc, 'id')],
    ['author', authorOf(doc)],
    ['mail', first(doc, 'mail')],
    ['url', first(doc, 'url')],
    ['ip', first(doc, 'ip')],
    ['location', first(doc, 'location')],
    ['ref', refLabel(doc)],
    ['state', stateLabel(first(doc, 'state'))],
    ['pin', first(doc, 'pin')],
    ['is_whispers', first(doc, 'is_whispers', 'isWhispers')],
    ['created_at', first(doc, 'created_at', 'createdAt')],
  ]
  return fields.filter(
    ([, value]) => value !== undefined && value !== null && value !== '',
  )
}

// ---------------------------------------------------------------------------
// Single-comment view
// ---------------------------------------------------------------------------

const renderCommentReadable = (data: unknown, color: boolean): string => {
  const doc = normalize(data)
  const author = authorOf(doc)
  const title = `comment from ${author}`
  return renderMetadataBlock(
    {
      title,
      kind: 'comment',
      fields: collectDetailFields(doc),
      body: firstString(doc, 'text') || undefined,
      bodyFormat: 'markdown',
    },
    { color },
  )
}

const renderCommentLlm = (data: unknown): string => {
  const doc = normalize(data)
  const fm = frontmatter({
    title: `comment ${firstString(doc, 'id') || ''}`.trim(),
    fields: collectDetailFields(doc),
  })
  const text = firstString(doc, 'text')
  return text ? `${fm}\n\n${text}` : fm
}

export const commentView: View<unknown> = {
  kind: 'comment',
  modes: new Set(['readable', 'llm']),
  readable: (data, ctx) => renderCommentReadable(data, ctx.color),
  llm: (data) => renderCommentLlm(data),
}

// ---------------------------------------------------------------------------
// List view
// ---------------------------------------------------------------------------

const renderListHeader = (
  payload: Record<string, unknown>,
  rowCount: number,
  color: boolean,
): string => {
  const envelopeMeta = asRecord(first(payload, 'meta'))
  const pagination = asRecord(first(envelopeMeta, 'pagination'))
  const page = first(pagination, 'page', 'currentPage')
  const size = first(pagination, 'size', 'pageSize')
  const total = first(pagination, 'total', 'totalCount', 'total_count')

  const headerParts: string[] = [`count: ${rowCount}`]
  if (page !== undefined) headerParts.push(`page: ${formatScalar(page)}`)
  if (size !== undefined) headerParts.push(`size: ${formatScalar(size)}`)
  if (total !== undefined) headerParts.push(`total: ${formatScalar(total)}`)

  const heading = wrap(ANSI.bold, 'Comments', color)
  const ruleLen = Math.min(
    Math.max(visibleLen('Comments'), 24),
    SEPARATOR_WIDTH,
  )
  const rule = wrap(ANSI.dim, '─'.repeat(ruleLen), color)
  const metaLine = wrap(ANSI.dim, headerParts.join('  ·  '), color)
  return `${heading}\n${rule}\n${metaLine}`
}

const renderListItem = (
  doc: Record<string, unknown>,
  index: number,
  color: boolean,
): string => {
  const author = authorOf(doc)
  const id = firstString(doc, 'id')
  const stateBadge =
    colorForCommentState(first(doc, 'state'), color) ??
    stateLabel(first(doc, 'state'))
  const ref = refLabel(doc)
  const created = first(doc, 'created_at', 'createdAt')

  const lines: string[] = []
  // Header: "1. <author>  [state]  <id>"
  const indexLabel = wrap(ANSI.dim, `${index + 1}.`, color)
  const authorBold = wrap(ANSI.bold, author, color)
  const idDim = id ? wrap(ANSI.dim, `#${id}`, color) : ''
  const header = [indexLabel, authorBold, `[${stateBadge}]`, idDim]
    .filter(Boolean)
    .join('  ')
  lines.push(header)

  // Meta line: ref · created_at
  const metaParts: string[] = []
  if (ref) metaParts.push(ref)
  if (created !== undefined) {
    metaParts.push(
      tryFormatTimestamp(created, { style: 'rel' }) ?? formatScalar(created),
    )
  }
  if (metaParts.length > 0) {
    lines.push(wrap(ANSI.dim, `   ${metaParts.join('  ·  ')}`, color))
  }

  // Body preview (one line, truncated).
  const text = firstString(doc, 'text')
  if (text) lines.push(`   ${truncate(oneLine(text))}`)

  return lines.join('\n')
}

const renderCommentListReadable = (data: unknown, color: boolean): string => {
  const payload = asRecord(data)
  const rows = Array.isArray(payload.data)
    ? (payload.data as unknown[])
    : Array.isArray(data)
      ? (data as unknown[])
      : []

  const header = renderListHeader(payload, rows.length, color)
  if (rows.length === 0) {
    const empty = wrap(ANSI.dim, '(no comments)', color)
    return `${header}\n\n${empty}`
  }

  const items = rows.map((row, index) =>
    renderListItem(asRecord(row), index, color),
  )
  return `${header}\n\n${items.join('\n\n')}`
}

const renderCommentListLlm = (data: unknown): string => {
  const payload = asRecord(data)
  const rows = Array.isArray(payload.data)
    ? (payload.data as unknown[])
    : Array.isArray(data)
      ? (data as unknown[])
      : []
  if (rows.length === 0) {
    // Render the markdown shape so consumers still see a header.
    return renderMarkdownToAnsi('# Comments\n\n_no comments_\n', {
      color: false,
    })
  }
  return rows
    .map((row) => {
      const doc = asRecord(row)
      const fm = frontmatter({
        title: `comment ${firstString(doc, 'id') || ''}`.trim(),
        fields: collectDetailFields(doc),
      })
      const text = firstString(doc, 'text')
      return text ? `${fm}\n\n${text}` : fm
    })
    .join('\n\n---\n\n')
}

export const commentListView: View<unknown> = {
  kind: 'comment-list',
  modes: new Set(['readable', 'llm']),
  readable: (data, ctx) => renderCommentListReadable(data, ctx.color),
  llm: (data) => renderCommentListLlm(data),
}
