import { SEPARATOR_WIDTH } from '../helpers'
import { ANSI, visibleLen, wrap } from '../markdown'
import type { LiteXmlNode } from './parser'
import type { BlockRenderer, RenderCtx, WalkApi } from './walker'

// Prefix each non-empty line of `text` with `prefix`. Empty lines stay empty so
// terminals don't show stray prefix glyphs on visual breathers.
const indentLines = (text: string, prefix: string): string =>
  text
    .split('\n')
    .map((line) => (line.length === 0 ? line : `${prefix}${line}`))
    .join('\n')

const padRight = (s: string, width: number): string => {
  const v = visibleLen(s)
  return v < width ? s + ' '.repeat(width - v) : s
}

const onlyElementChildren = (
  children: ReadonlyArray<LiteXmlNode>,
): ReadonlyArray<Extract<LiteXmlNode, { type: 'element' }>> =>
  children.filter(
    (c): c is Extract<LiteXmlNode, { type: 'element' }> => c.type === 'element',
  )

export const paragraphRenderer: BlockRenderer = (node, ctx, inner) =>
  inner.walkInlineChildren(node.children, ctx)

const makeHeading =
  (level: number): BlockRenderer =>
  (node, ctx, inner) => {
    const text = inner.walkInlineChildren(node.children, ctx)
    if (level === 1) {
      const styled = wrap(`${ANSI.bold}${ANSI.magenta}`, text, ctx.color)
      const rule = wrap(
        ANSI.dim,
        '─'.repeat(Math.max(visibleLen(text), 1)),
        ctx.color,
      )
      return `${styled}\n${rule}`
    }
    if (level === 2) {
      const styled = wrap(`${ANSI.bold}${ANSI.cyan}`, text, ctx.color)
      const rule = wrap(
        ANSI.dim,
        '─'.repeat(Math.max(visibleLen(text), 1)),
        ctx.color,
      )
      return `${styled}\n${rule}`
    }
    return wrap(ANSI.bold, text, ctx.color)
  }

export const h1Renderer = makeHeading(1)
export const h2Renderer = makeHeading(2)
export const h3Renderer = makeHeading(3)
export const h4Renderer = makeHeading(4)
export const h5Renderer = makeHeading(5)
export const h6Renderer = makeHeading(6)

export const blockquoteRenderer: BlockRenderer = (node, ctx, inner) => {
  const body = inner.walkBlockChildren(node.children, ctx)
  const prefix = wrap(ANSI.dim, '│ ', ctx.color)
  const out = indentLines(body, prefix)
  const attribution = node.attrs.attribution
  if (attribution) {
    const attrLine = wrap(ANSI.dim, `   — ${attribution}`, ctx.color)
    return out ? `${out}\n${attrLine}` : attrLine
  }
  return out
}

export const hrRenderer: BlockRenderer = (_node, ctx) =>
  wrap(ANSI.dim, '─'.repeat(SEPARATOR_WIDTH), ctx.color)

const renderListItemBody = (
  li: Extract<LiteXmlNode, { type: 'element' }>,
  ctx: RenderCtx,
  inner: WalkApi,
): { readonly inlineHead: string; readonly nested: string } => {
  // Split children: inline-ish content first (with paragraph breaks preserved
  // as `\n`-joined segments), nested ul/ol below.
  const segments: string[] = []
  let buffer: LiteXmlNode[] = []
  const nestedBlocks: Array<Extract<LiteXmlNode, { type: 'element' }>> = []
  const flush = () => {
    if (buffer.length === 0) return
    segments.push(inner.walkInlineChildren(buffer, ctx))
    buffer = []
  }
  for (const c of li.children) {
    if (c.type === 'element' && (c.tag === 'ul' || c.tag === 'ol')) {
      flush()
      nestedBlocks.push(c)
    } else if (c.type === 'element' && c.tag === 'p') {
      flush()
      segments.push(inner.walkInlineChildren(c.children, ctx))
    } else if (c.type === 'text' && /^\s*$/.test(c.value)) {
      // skip pretty-print whitespace between sibling paragraphs
      continue
    } else {
      buffer.push(c)
    }
  }
  flush()
  const head = segments.join('\n')
  const nested =
    nestedBlocks.length > 0
      ? inner.walkBlockChildren(nestedBlocks, {
          ...ctx,
          indent: ctx.indent + 2,
        })
      : ''
  return { inlineHead: head, nested }
}

const liPrefix = (
  li: Extract<LiteXmlNode, { type: 'element' }>,
  ordinal: number | null,
  numWidth: number,
  ctx: RenderCtx,
): string => {
  const checked = li.attrs.checked
  if (checked === 'true') return wrap(ANSI.dim, '[x] ', ctx.color)
  if (checked === 'false') return wrap(ANSI.dim, '[ ] ', ctx.color)
  if (ordinal != null) {
    const label = `${ordinal}.`.padStart(numWidth)
    return `${label} `
  }
  return '- '
}

const renderList =
  (ordered: boolean): BlockRenderer =>
  (node, ctx, inner) => {
    const items = onlyElementChildren(node.children).filter(
      (c) => c.tag === 'li',
    )
    if (items.length === 0) return ''
    const numWidth = ordered ? String(items.length).length + 1 : 0
    const indentStr = ' '.repeat(ctx.indent)
    const lines: string[] = []
    items.forEach((item, idx) => {
      const prefix = liPrefix(item, ordered ? idx + 1 : null, numWidth, ctx)
      const { inlineHead, nested } = renderListItemBody(item, ctx, inner)
      const contIndent = ' '.repeat(visibleLen(prefix))
      const head = inlineHead
        .split('\n')
        .map((line, i) => (i === 0 ? line : `${contIndent}${line}`))
        .join('\n')
      lines.push(`${indentStr}${prefix}${head}`)
      if (nested) lines.push(nested)
    })
    return lines.join('\n')
  }

export const ulRenderer = renderList(false)
export const olRenderer = renderList(true)

// Defensive: `<li>` dispatched outside a list — render as a paragraph.
export const liRenderer: BlockRenderer = (node, ctx, inner) =>
  inner.walkInlineChildren(node.children, ctx)

export const tableRenderer: BlockRenderer = (node, ctx, inner) => {
  const rows = onlyElementChildren(node.children).filter((c) => c.tag === 'tr')
  if (rows.length === 0) return ''
  const matrix: string[][] = rows.map((row) =>
    onlyElementChildren(row.children)
      .filter((c) => c.tag === 'th' || c.tag === 'td')
      .map((cell) => inner.walkInlineChildren(cell.children, ctx)),
  )
  const numCols = Math.max(...matrix.map((r) => r.length))
  const widths: number[] = []
  for (let i = 0; i < numCols; i++) {
    let max = 0
    for (const row of matrix) {
      const cell = row[i] ?? ''
      if (visibleLen(cell) > max) max = visibleLen(cell)
    }
    widths.push(max)
  }
  const headerIsAllTh =
    rows.length > 0 &&
    onlyElementChildren(rows[0].children).every((c) => c.tag === 'th')
  const lines: string[] = []
  matrix.forEach((row, rowIdx) => {
    const padded = row.map((cell, idx) => padRight(cell, widths[idx] ?? 0))
    const rendered =
      rowIdx === 0 && headerIsAllTh
        ? padded.map((c) => wrap(ANSI.bold, c, ctx.color))
        : padded
    lines.push(rendered.join(' │ '))
    if (rowIdx === 0 && headerIsAllTh) {
      const sep = widths.map((w) => '─'.repeat(w)).join('─┼─')
      lines.push(wrap(ANSI.dim, sep, ctx.color))
    }
  })
  return lines.join('\n')
}

const ALERT_LABEL_COLOR: Record<string, string> = {
  info: ANSI.cyan,
  tip: ANSI.cyan,
  warning: ANSI.yellow,
  error: ANSI.red,
  success: ANSI.green,
  note: ANSI.dim,
}

const renderBox =
  (defaultType: string): BlockRenderer =>
  (node, ctx, inner) => {
    const type = (node.attrs.type ?? defaultType).toLowerCase()
    const colorCode = ALERT_LABEL_COLOR[type] ?? ANSI.cyan
    const labelLine = wrap(colorCode, type.toUpperCase(), ctx.color)
    const rule = wrap(ANSI.dim, '─'.repeat(SEPARATOR_WIDTH), ctx.color)
    const body = inner.walkBlockChildren(node.children, ctx)
    const prefix = wrap(ANSI.dim, '│ ', ctx.color)
    const indented = indentLines(body, prefix)
    return `${labelLine}\n${rule}\n${indented}\n${rule}`
  }

export const alertRenderer = renderBox('info')
export const bannerRenderer = renderBox('info')

export const detailsRenderer: BlockRenderer = (node, ctx, inner) => {
  const summary = node.attrs.summary ?? ''
  const head = wrap(ANSI.dim, `▸ ${summary}`, ctx.color)
  const body = inner.walkBlockChildren(node.children, ctx)
  if (!body) return head
  const indented = indentLines(body, '  ')
  return `${head}\n${indented}`
}

export const spoilerRenderer: BlockRenderer = (node, ctx, inner) => {
  const text = inner.walkInlineChildren(node.children, ctx)
  return wrap(ANSI.dim, text, ctx.color)
}

export const blockRendererEntries: ReadonlyArray<
  readonly [string, BlockRenderer]
> = [
  ['p', paragraphRenderer],
  ['h1', h1Renderer],
  ['h2', h2Renderer],
  ['h3', h3Renderer],
  ['h4', h4Renderer],
  ['h5', h5Renderer],
  ['h6', h6Renderer],
  ['blockquote', blockquoteRenderer],
  ['hr', hrRenderer],
  ['ul', ulRenderer],
  ['ol', olRenderer],
  ['li', liRenderer],
  ['table', tableRenderer],
  ['alert', alertRenderer],
  ['banner', bannerRenderer],
  ['details', detailsRenderer],
  ['spoiler', spoilerRenderer],
]
