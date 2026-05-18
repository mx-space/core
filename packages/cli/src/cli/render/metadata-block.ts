import { formatScalar } from '../../services/Renderer/content'
import { formatStateBadge, SEPARATOR_WIDTH } from './helpers'
import { ANSI, renderMarkdownToAnsi, visibleLen, wrap } from './markdown'

export interface MetadataBlockInput {
  readonly title?: string
  /** Fallback heading when title is empty (e.g. kind label like 'post'). */
  readonly kind?: string
  readonly fields: ReadonlyArray<readonly [string, unknown]>
  /** Optional summary line shown dim below the field block. */
  readonly summary?: string
  /** Body string. Routed through markdown renderer iff bodyFormat = 'markdown'. */
  readonly body?: string
  readonly bodyFormat?: 'markdown' | 'litexml' | 'text'
}

export const renderMetadataBlock = (
  input: MetadataBlockInput,
  ctx: { readonly color: boolean },
): string => {
  const { color } = ctx
  const { title, kind, fields: rawFields, summary, body, bodyFormat } = input
  const fields = rawFields.filter(
    ([, value]) => value !== undefined && value !== null && value !== '',
  )

  const lines: string[] = []
  if (title) {
    lines.push(wrap(ANSI.bold, title, color))
    const ruleLen = Math.min(Math.max(visibleLen(title), 24), SEPARATOR_WIDTH)
    lines.push(wrap(ANSI.dim, '─'.repeat(ruleLen), color))
  } else if (kind) {
    lines.push(kind)
  }

  const labelWidth = fields.reduce((max, [key]) => Math.max(max, key.length), 0)
  for (const [key, value] of fields) {
    const label = wrap(ANSI.dim, key.padEnd(labelWidth), color)
    const rendered =
      key === 'state'
        ? (formatStateBadge(value, color) ?? formatScalar(value))
        : formatScalar(value)
    lines.push(`${label}  ${rendered}`)
  }

  if (summary) {
    lines.push('')
    lines.push(wrap(ANSI.dim, summary, color))
  }

  if (body) {
    lines.push('')
    lines.push(wrap(ANSI.dim, '─'.repeat(SEPARATOR_WIDTH), color))
    lines.push('')
    if (bodyFormat === 'markdown') {
      lines.push(renderMarkdownToAnsi(body, { color }))
    } else {
      lines.push(body)
    }
  }
  return lines.join('\n')
}
