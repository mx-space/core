import { blockRendererEntries } from './blocks'
import { codeblockRenderer } from './code'
import { embedRendererEntries } from './embeds'
import { inlineRendererEntries } from './inlines'
import { parseLitexml } from './parser'
import { type BlockRenderer, createWalker, type InlineRenderer } from './walker'

export type { LiteXmlNode } from './parser'
export { parseLitexml } from './parser'
export {
  type BlockRenderer,
  type InlineRenderer,
  type RenderCtx,
  type WalkApi,
} from './walker'

export const blockRenderers = new Map<string, BlockRenderer>([
  ...blockRendererEntries,
  ...embedRendererEntries,
  ['codeblock', codeblockRenderer],
])

export const inlineRenderers = new Map<string, InlineRenderer>(
  inlineRendererEntries,
)

const defaultWalker = createWalker({
  blocks: blockRenderers,
  inlines: inlineRenderers,
})

export const renderLexicalAnsi = (
  xml: string,
  opts: { readonly color: boolean },
): string => {
  const nodes = parseLitexml(xml)
  const out = defaultWalker.walkBlockChildren(nodes, {
    color: opts.color,
    indent: 0,
  })
  return out.replace(/\n+$/, '')
}
