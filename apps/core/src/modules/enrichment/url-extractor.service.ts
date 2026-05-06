import { Injectable } from '@nestjs/common'
import { marked } from 'marked'

import type { ContentFormat } from '~/shared/types/content-format.type'
import { isLexical } from '~/utils/content.util'

interface ContentDoc {
  text?: string | null
  content?: string | null
  contentFormat?: ContentFormat | string | null
}

@Injectable()
export class UrlExtractorService {
  extractFromMarkdown(content: string | null | undefined): string[] {
    if (!content) return []
    let tokens: ReturnType<typeof marked.lexer>
    try {
      tokens = marked.lexer(content)
    } catch {
      return []
    }
    const urls = new Set<string>()
    for (const tok of tokens) {
      const url = pickSingleLinkParagraph(tok)
      if (url) urls.add(url)
    }
    return [...urls]
  }

  extractFromLexical(stateOrJson: unknown): string[] {
    const root = resolveLexicalRoot(stateOrJson)
    if (!root) return []
    const urls = new Set<string>()
    walkLexical(root, urls)
    return [...urls]
  }

  extractFromDoc(doc: ContentDoc): string[] {
    if (isLexical({ contentFormat: doc.contentFormat })) {
      const raw = doc.content || doc.text
      if (!raw) return []
      try {
        return this.extractFromLexical(JSON.parse(raw))
      } catch {
        return []
      }
    }
    return this.extractFromMarkdown(doc.text)
  }
}

function pickSingleLinkParagraph(token: any): string | null {
  if (token?.type !== 'paragraph') return null
  const inner = Array.isArray(token.tokens) ? token.tokens : []
  if (inner.length !== 1) return null
  const sole = inner[0]
  if (sole?.type === 'link' && typeof sole.href === 'string') {
    return sole.href.trim() || null
  }
  return null
}

function resolveLexicalRoot(input: unknown): any {
  if (!input || typeof input !== 'object') return null
  const node: any = input
  if (Array.isArray(node.children)) return node
  if (node.root && Array.isArray(node.root.children)) return node.root
  return null
}

function walkLexical(node: any, out: Set<string>): void {
  if (!node || typeof node !== 'object') return
  if (node.type === 'link-card' && typeof node.url === 'string') {
    const trimmed = node.url.trim()
    if (trimmed) out.add(trimmed)
  }
  const children = node.children
  if (Array.isArray(children)) {
    for (const child of children) walkLexical(child, out)
  }
}
