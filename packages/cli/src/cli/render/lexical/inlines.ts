import { ANSI, visibleLen, wrap } from '../markdown'
import type { InlineRenderer } from './walker'

// Specific reset codes (not ANSI.reset) so nested formats survive — e.g.
// closing italic with `\x1b[23m` doesn't strip an outer bold.
const formatPair = (open: string, close: string): InlineRenderer => {
  return (node, ctx, inner) => {
    const text = inner.walkInlineChildren(node.children, ctx)
    return ctx.color ? `${open}${text}${close}` : text
  }
}

export const boldRenderer: InlineRenderer = formatPair('\x1B[1m', '\x1B[22m')
export const italicRenderer: InlineRenderer = formatPair('\x1B[3m', '\x1B[23m')
export const strikeRenderer: InlineRenderer = formatPair('\x1B[9m', '\x1B[29m')
export const underlineRenderer: InlineRenderer = formatPair(
  '\x1B[4m',
  '\x1B[24m',
)
// Inline `code`: dim only — italic on top of dim renders inconsistently
// across terminals and breaks alignment when copy-pasted.
export const codeRenderer: InlineRenderer = formatPair('\x1B[2m', '\x1B[22m')
// `sub`/`sup`: no real subscript/superscript in TTY — degrade to dim so the
// content stays distinguishable but doesn't disrupt the line.
export const subRenderer: InlineRenderer = formatPair('\x1B[2m', '\x1B[22m')
export const supRenderer: InlineRenderer = formatPair('\x1B[2m', '\x1B[22m')
export const markRenderer: InlineRenderer = formatPair('\x1B[7m', '\x1B[27m')

export const linkRenderer: InlineRenderer = (node, ctx, inner) => {
  const href = node.attrs.href ?? ''
  const text = inner.walkInlineChildren(node.children, ctx)
  if (!href) return text
  // If text already reveals the URL there's no point appending it.
  if (visibleLen(text) > 0 && text.trim() === href) return text
  const suffix = wrap(ANSI.dim, ` (${href})`, ctx.color)
  return `${text}${suffix}`
}

export const brRenderer: InlineRenderer = () => '\n'

export const mentionRenderer: InlineRenderer = (node, ctx, inner) => {
  const handle = node.attrs.handle ?? ''
  const display = inner.walkInlineChildren(node.children, ctx).trim()
  const label = display || handle
  return wrap(ANSI.dim, `@${label}`, ctx.color)
}

export const tagRenderer: InlineRenderer = (node, ctx, inner) => {
  const text = inner.walkInlineChildren(node.children, ctx).trim()
  return wrap(ANSI.dim, `#${text}`, ctx.color)
}

export const commentRenderer: InlineRenderer = (node, ctx, inner) => {
  const text = inner.walkInlineChildren(node.children, ctx)
  return wrap(ANSI.dim, text, ctx.color)
}

export const footnoteRenderer: InlineRenderer = (node, ctx) => {
  const ref = node.attrs.ref ?? ''
  return wrap(ANSI.dim, `[^${ref}]`, ctx.color)
}

export const rubyRenderer: InlineRenderer = (node, ctx, inner) => {
  const base = inner.walkInlineChildren(node.children, ctx)
  const rt = node.attrs.rt ?? ''
  if (!rt) return base
  const suffix = wrap(ANSI.dim, ` (${rt})`, ctx.color)
  return `${base}${suffix}`
}

export const inlineRendererEntries: ReadonlyArray<
  readonly [string, InlineRenderer]
> = [
  ['b', boldRenderer],
  ['i', italicRenderer],
  ['s', strikeRenderer],
  ['u', underlineRenderer],
  ['code', codeRenderer],
  ['sub', subRenderer],
  ['sup', supRenderer],
  ['mark', markRenderer],
  ['a', linkRenderer],
  ['br', brRenderer],
  ['mention', mentionRenderer],
  ['tag', tagRenderer],
  ['comment', commentRenderer],
  ['footnote', footnoteRenderer],
  ['ruby', rubyRenderer],
]
