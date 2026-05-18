import { highlightCode } from '../codehighlight'
import { ANSI, wrap } from '../markdown'
import type { LiteXmlNode } from './parser'
import type { BlockRenderer } from './walker'

const collectText = (children: ReadonlyArray<LiteXmlNode>): string => {
  let out = ''
  for (const child of children) {
    if (child.type === 'text') out += child.value
    else out += collectText(child.children)
  }
  return out
}

export const codeblockRenderer: BlockRenderer = (node, ctx) => {
  const lang = node.attrs.lang ?? ''
  const code = collectText(node.children).replace(/\n+$/, '')
  const body = highlightCode(code, lang, ctx.color)
  if (lang) {
    const label = wrap(ANSI.dim, lang, ctx.color)
    return `${label}\n${body}`
  }
  return body
}
