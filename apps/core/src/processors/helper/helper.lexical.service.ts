import { createHeadlessEditor } from '@lexical/headless'
import {
  $isAutoLinkNode,
  $isLinkNode,
  AutoLinkNode,
  LinkNode,
} from '@lexical/link'
import {
  $isListItemNode,
  $isListNode,
  ListItemNode,
  ListNode,
} from '@lexical/list'
import {
  $isHeadingNode,
  $isQuoteNode,
  HeadingNode,
  QuoteNode,
} from '@lexical/rich-text'
import { Injectable } from '@nestjs/common'
import { ContentFormat } from '~/shared/types/content-format.type'
import {
  $getRoot,
  $isElementNode,
  $isLineBreakNode,
  $isTextNode,
  ElementNode,
  TextNode,
  type Klass,
  type LexicalNode,
  type SerializedElementNode,
  type SerializedTextNode,
} from 'lexical'

// ── Minimal CodeNode (replaces @lexical/code to avoid PrismJS) ──

interface SerializedSimpleCodeNode extends SerializedElementNode {
  language?: string
}

class SimpleCodeNode extends ElementNode {
  __language?: string

  static getType(): string {
    return 'code'
  }

  static clone(node: SimpleCodeNode): SimpleCodeNode {
    const n = new SimpleCodeNode(node.__key)
    n.__language = node.__language
    return n
  }

  static importJSON(json: SerializedSimpleCodeNode): SimpleCodeNode {
    const node = new SimpleCodeNode()
    node.__language = json.language
    return node
  }

  exportJSON(): SerializedSimpleCodeNode {
    return { ...super.exportJSON(), type: 'code', language: this.__language }
  }

  createDOM(): HTMLElement {
    return document.createElement('code')
  }

  updateDOM(): boolean {
    return false
  }

  getLanguage(): string | undefined {
    return this.__language
  }
}

class SimpleCodeHighlightNode extends TextNode {
  __highlightType?: string | null

  static getType(): string {
    return 'code-highlight'
  }

  static clone(node: SimpleCodeHighlightNode): SimpleCodeHighlightNode {
    const n = new SimpleCodeHighlightNode(node.__text, node.__key)
    n.__highlightType = node.__highlightType
    return n
  }

  static importJSON(
    json: SerializedTextNode & { highlightType?: string | null },
  ): SimpleCodeHighlightNode {
    const node = new SimpleCodeHighlightNode(json.text)
    node.setFormat(json.format)
    node.__highlightType = json.highlightType
    return node
  }

  exportJSON() {
    return {
      ...super.exportJSON(),
      type: 'code-highlight' as const,
      highlightType: this.__highlightType,
    }
  }
}

// ── Node registry ──

const EDITOR_NODES: Klass<LexicalNode>[] = [
  HeadingNode,
  QuoteNode,
  ListNode,
  ListItemNode,
  SimpleCodeNode,
  SimpleCodeHighlightNode,
  LinkNode,
  AutoLinkNode,
]

// ── Text format bitmask ──

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

// ── Inline node → Markdown ──

function inlineToMarkdown(node: LexicalNode): string {
  if ($isTextNode(node)) {
    return wrapTextFormat(node.getTextContent(), node.getFormat())
  }
  if ($isLineBreakNode(node)) return '\n'
  if ($isLinkNode(node) || $isAutoLinkNode(node)) {
    const children = (node as ElementNode)
      .getChildren()
      .map(inlineToMarkdown)
      .join('')
    return `[${children}](${(node as any).getURL()})`
  }
  if ($isElementNode(node)) {
    return node.getChildren().map(inlineToMarkdown).join('')
  }
  return node.getTextContent()
}

// ── Block node → Markdown ──

function blockToMarkdown(node: LexicalNode): string {
  if ($isHeadingNode(node)) {
    const tag = node.getTag() // 'h1' .. 'h6'
    const level = Number(tag.replace('h', ''))
    const text = node.getChildren().map(inlineToMarkdown).join('')
    return `${'#'.repeat(level)} ${text}`
  }

  if ($isQuoteNode(node)) {
    const text = node.getChildren().map(inlineToMarkdown).join('')
    return `> ${text}`
  }

  if (node instanceof SimpleCodeNode) {
    const lang = node.getLanguage() ?? ''
    const code = node.getTextContent()
    return `\`\`\`${lang}\n${code}\n\`\`\``
  }

  if ($isListNode(node)) {
    return listToMarkdown(node, 0)
  }

  if ($isElementNode(node)) {
    return node.getChildren().map(inlineToMarkdown).join('')
  }

  return node.getTextContent()
}

function listToMarkdown(node: ListNode, depth: number): string {
  const items = node.getChildren()
  const lines: string[] = []
  const indent = '    '.repeat(depth)
  const isOrdered = node.getListType() === 'number'

  for (const item of items) {
    if (!$isListItemNode(item)) continue
    const children = item.getChildren()
    const nested = children.find($isListNode) as ListNode | undefined
    const inlineChildren = children.filter((c) => !$isListNode(c))
    const text = inlineChildren.map(inlineToMarkdown).join('')
    const bullet = isOrdered ? `${item.getValue()}. ` : '- '
    lines.push(`${indent}${bullet}${text}`)
    if (nested) lines.push(listToMarkdown(nested, depth + 1))
  }

  return lines.join('\n')
}

// ── Service ──

@Injectable()
export class LexicalService {
  lexicalToMarkdown(editorState: string): string {
    const editor = createHeadlessEditor({
      nodes: EDITOR_NODES,
      onError: (error) => {
        throw error
      },
    })

    const parsed = editor.parseEditorState(editorState)
    editor.setEditorState(parsed)

    let markdown = ''
    editor.read(() => {
      const root = $getRoot()
      markdown = root
        .getChildren()
        .map((child) => blockToMarkdown(child))
        .join('\n\n')
    })

    return markdown
  }

  populateText<
    T extends {
      contentFormat?: ContentFormat | string
      content?: string
      text: string
    },
  >(doc: T): boolean {
    if (doc.contentFormat === ContentFormat.Lexical && doc.content) {
      doc.text = this.lexicalToMarkdown(doc.content)
      return true
    }
    return false
  }
}
