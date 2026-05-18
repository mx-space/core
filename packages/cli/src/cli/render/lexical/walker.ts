import type { LiteXmlNode } from './parser'

export interface RenderCtx {
  readonly color: boolean
  readonly indent: number
}

export interface WalkApi {
  readonly walkBlock: (node: LiteXmlNode, ctx: RenderCtx) => string
  readonly walkInline: (node: LiteXmlNode, ctx: RenderCtx) => string
  readonly walkBlockChildren: (
    children: ReadonlyArray<LiteXmlNode>,
    ctx: RenderCtx,
  ) => string
  readonly walkInlineChildren: (
    children: ReadonlyArray<LiteXmlNode>,
    ctx: RenderCtx,
  ) => string
}

export type BlockRenderer = (
  node: Extract<LiteXmlNode, { type: 'element' }>,
  ctx: RenderCtx,
  inner: WalkApi,
) => string

export type InlineRenderer = (
  node: Extract<LiteXmlNode, { type: 'element' }>,
  ctx: RenderCtx,
  inner: WalkApi,
) => string

export const createWalker = (registries: {
  readonly blocks: ReadonlyMap<string, BlockRenderer>
  readonly inlines: ReadonlyMap<string, InlineRenderer>
}): WalkApi => {
  const walkInline = (node: LiteXmlNode, ctx: RenderCtx): string => {
    if (node.type === 'text') return node.value
    const inline = registries.inlines.get(node.tag)
    if (inline) return inline(node, ctx, api)
    return walkInlineChildren(node.children, ctx)
  }

  const walkBlock = (node: LiteXmlNode, ctx: RenderCtx): string => {
    if (node.type === 'text') return node.value
    const block = registries.blocks.get(node.tag)
    if (block) return block(node, ctx, api)
    return walkBlockChildren(node.children, ctx)
  }

  const walkInlineChildren = (
    children: ReadonlyArray<LiteXmlNode>,
    ctx: RenderCtx,
  ): string => {
    let out = ''
    for (const child of children) out += walkInline(child, ctx)
    return out
  }

  const walkBlockChildren = (
    children: ReadonlyArray<LiteXmlNode>,
    ctx: RenderCtx,
  ): string => {
    if (children.length === 0) return ''
    let out = ''
    let first = true
    for (const child of children) {
      // Drop whitespace-only text nodes between blocks — these are pretty-print
      // artifacts from the upstream XML serializer (litexml `compact: false`).
      if (child.type === 'text' && /^\s*$/.test(child.value)) continue
      const rendered = walkBlock(child, ctx)
      if (!rendered) continue
      if (!first) out += '\n\n'
      out += rendered
      first = false
    }
    return out
  }

  const api: WalkApi = {
    walkBlock,
    walkInline,
    walkBlockChildren,
    walkInlineChildren,
  }
  return api
}
