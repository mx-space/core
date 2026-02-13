// Lexical translation parser: extract translatable text nodes, convert to Markdown, restore after translation.
// Operates on serialized JSON only (no Lexical runtime).

const TRANSLATABLE_TYPES = new Set([
  'paragraph',
  'heading',
  'list',
  'quote',
  'listitem',
])

function isTranslatable(type: string): boolean {
  return TRANSLATABLE_TYPES.has(type)
}

function hasNestedEditorContent(node: any): boolean {
  return !!node.content?.root?.children
}

export interface TextNodeRef {
  id: string
  node: any
  originalText: string
}

export interface TranslationChunk {
  markdown: string
  textNodes: TextNodeRef[]
}

export interface LexicalTranslationParseResult {
  chunks: TranslationChunk[]
  editorState: any
}

// ── Text format bitmask (mirrors helper.lexical.service.ts) ──

const FORMAT_BOLD = 1
const FORMAT_ITALIC = 2
const FORMAT_STRIKETHROUGH = 4
const FORMAT_CODE = 16

function wrapTextFormat(text: string, format: number): string {
  let r = text
  if (format & FORMAT_CODE) r = `\`${r}\``
  if (format & FORMAT_BOLD) r = `**${r}**`
  if (format & FORMAT_ITALIC) r = `*${r}*`
  if (format & FORMAT_STRIKETHROUGH) r = `~~${r}~~`
  return r
}

// ── Standalone JSON-based Markdown converter ──

function inlineNodeToMarkdown(node: any): string {
  if (!node) return ''

  if (node.type === 'text') {
    return wrapTextFormat(node.text ?? '', node.format ?? 0)
  }
  if (node.type === 'linebreak') return '\n'
  if (node.type === 'link' || node.type === 'autolink') {
    const children = (node.children ?? []).map(inlineNodeToMarkdown).join('')
    return `[${children}](${node.url ?? ''})`
  }
  if (Array.isArray(node.children)) {
    return node.children.map(inlineNodeToMarkdown).join('')
  }
  return node.text ?? ''
}

function blockNodeToMarkdown(node: any): string {
  if (!node) return ''

  if (node.type === 'heading') {
    const tag: string = node.tag ?? 'h1'
    const level = Number(tag.replace('h', '')) || 1
    const text = (node.children ?? []).map(inlineNodeToMarkdown).join('')
    return `${'#'.repeat(level)} ${text}`
  }

  if (node.type === 'quote') {
    const text = (node.children ?? []).map(inlineNodeToMarkdown).join('')
    return `> ${text}`
  }

  if (node.type === 'list') {
    return listNodeToMarkdown(node, 0)
  }

  if (node.type === 'paragraph') {
    return (node.children ?? []).map(inlineNodeToMarkdown).join('')
  }

  // Nodes with nested editor content (e.g. alert-quote)
  if (hasNestedEditorContent(node)) {
    const nestedChildren: any[] = node.content.root.children ?? []
    return nestedChildren.map(blockNodeToMarkdown).join('\n\n')
  }

  if (Array.isArray(node.children)) {
    return node.children.map(inlineNodeToMarkdown).join('')
  }

  return node.text ?? ''
}

function listNodeToMarkdown(node: any, depth: number): string {
  const items: any[] = node.children ?? []
  const lines: string[] = []
  const indent = '    '.repeat(depth)
  const isOrdered = node.listType === 'number'

  for (const [i, item] of items.entries()) {
    if (item.type !== 'listitem') continue
    const children: any[] = item.children ?? []
    const nested = children.find((c: any) => c.type === 'list')
    const inlineChildren = children.filter((c: any) => c.type !== 'list')
    const text = inlineChildren.map(inlineNodeToMarkdown).join('')
    const bullet = isOrdered ? `${item.value ?? i + 1}. ` : '- '
    lines.push(`${indent}${bullet}${text}`)
    if (nested) lines.push(listNodeToMarkdown(nested, depth + 1))
  }

  return lines.join('\n')
}

// ── Collect text leaf nodes from a translatable block ──

function collectTextNodes(
  node: any,
  refs: TextNodeRef[],
  counter: { value: number },
): void {
  if (!node) return
  if (node.type === 'text') {
    const text = node.text ?? ''
    if (!text.trim()) return
    const id = `t_${counter.value++}`
    refs.push({ id, node, originalText: text })
    return
  }
  // Descend into nested editor content (e.g. alert-quote)
  if (hasNestedEditorContent(node)) {
    for (const child of node.content.root.children) {
      collectTextNodes(child, refs, counter)
    }
  }
  if (Array.isArray(node.children)) {
    for (const child of node.children) {
      collectTextNodes(child, refs, counter)
    }
  }
}

// ── Parser ──

export function parseLexicalForTranslation(
  editorStateJson: string,
): LexicalTranslationParseResult {
  const editorState = structuredClone(JSON.parse(editorStateJson))
  const rootChildren: any[] = editorState.root?.children ?? []

  const chunks: TranslationChunk[] = []
  let currentNodes: any[] = []
  const counter = { value: 0 }

  const finalizeChunk = () => {
    if (!currentNodes.length) return
    const textNodes: TextNodeRef[] = []
    for (const node of currentNodes) {
      collectTextNodes(node, textNodes, counter)
    }
    if (textNodes.length) {
      const markdown = currentNodes.map(blockNodeToMarkdown).join('\n\n')
      chunks.push({ markdown, textNodes })
    }
    currentNodes = []
  }

  for (const child of rootChildren) {
    if (isTranslatable(child.type) || hasNestedEditorContent(child)) {
      currentNodes.push(child)
    } else {
      finalizeChunk()
    }
  }
  finalizeChunk()

  return { chunks, editorState }
}

// ── Restorer ──

export function restoreLexicalTranslation(
  editorState: any,
  translations: Map<string, string>,
  chunks: TranslationChunk[],
): string {
  for (const chunk of chunks) {
    for (const ref of chunk.textNodes) {
      ref.node.text = translations.get(ref.id) ?? ref.originalText
    }
  }
  return JSON.stringify(editorState)
}
