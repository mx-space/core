import { Injectable } from '@nestjs/common'
import type { Token, Tokens } from 'marked'
import { marked } from 'marked'

import type { ContentFormat } from '~/shared/types/content-format.type'
import {
  isLexical,
  isNestedLexicalEditorState,
  traverseLexicalNodes,
} from '~/utils/content.util'

export interface ContentDoc {
  text?: string | null
  content?: string | null
  contentFormat?: ContentFormat | string | null
}

type LexicalNodeRecord = Record<string, unknown>

@Injectable()
export class UrlExtractorService {
  extractFromMarkdown(content: string | null | undefined): string[] {
    if (!content) return []
    let tokens: Token[]
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
    traverseLexicalNodes(root, (node: LexicalNodeRecord) => {
      if (node?.type !== 'link-card') return
      const url = node.url
      if (typeof url !== 'string') return
      const trimmed = url.trim()
      if (trimmed) urls.add(trimmed)
    })
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

function pickSingleLinkParagraph(token: Token): string | null {
  if (token.type !== 'paragraph') return null
  const inner = (token as Tokens.Paragraph).tokens
  if (!Array.isArray(inner) || inner.length !== 1) return null
  const sole = inner[0]
  if (sole?.type !== 'link') return null
  const href = (sole as Tokens.Link).href
  if (typeof href !== 'string') return null
  return href.trim() || null
}

function resolveLexicalRoot(input: unknown): LexicalNodeRecord | null {
  if (!input || typeof input !== 'object') return null
  if (isNestedLexicalEditorState(input)) {
    return input.root as unknown as LexicalNodeRecord
  }
  const node = input as LexicalNodeRecord
  if (Array.isArray(node.children)) return node
  return null
}
