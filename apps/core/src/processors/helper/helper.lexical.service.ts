import { $toMarkdown, allHeadlessNodes } from '@haklex/rich-headless'
import { createHeadlessEditor } from '@lexical/headless'
import { Injectable } from '@nestjs/common'
import { ContentFormat } from '~/shared/types/content-format.type'
import { md5 } from '~/utils/tool.util'
import { nanoid } from 'nanoid'

const NODE_STATE_KEY = '$'
const BLOCK_ID_STATE_KEY = 'blockId'
const KNOWN_STRUCTURAL_PROPS = new Set([
  'children',
  'type',
  'version',
  'direction',
  'format',
  'indent',
  'style',
  'detail',
  'mode',
  'text',
  'tag',
  'listType',
  'start',
  'value',
  'url',
  'rel',
  'target',
  'colSpan',
  'headerState',
  'width',
  NODE_STATE_KEY,
])

export interface LexicalRootBlock {
  id: string | null
  type: string
  text: string
  fingerprint: string
  index: number
}

@Injectable()
export class LexicalService {
  private createBlockId() {
    return `blk_${nanoid(6)}`
  }

  private parseEditorState(content: string): any | null {
    try {
      return JSON.parse(content)
    } catch {
      return null
    }
  }

  private getNodeState(node: any): Record<string, any> | null {
    const state = node?.[NODE_STATE_KEY]
    if (!state || typeof state !== 'object' || Array.isArray(state)) {
      return null
    }
    return state
  }

  private readBlockId(node: any): string | null {
    const state = this.getNodeState(node)
    const blockId = state?.[BLOCK_ID_STATE_KEY]
    if (typeof blockId !== 'string' || !blockId.trim()) {
      return null
    }
    return blockId.trim()
  }

  private writeBlockId(node: any, blockId: string): boolean {
    let changed = false

    if (!node[NODE_STATE_KEY] || typeof node[NODE_STATE_KEY] !== 'object') {
      node[NODE_STATE_KEY] = {}
      changed = true
    }

    if (node[NODE_STATE_KEY][BLOCK_ID_STATE_KEY] !== blockId) {
      node[NODE_STATE_KEY][BLOCK_ID_STATE_KEY] = blockId
      changed = true
    }

    return changed
  }

  private normalizeText(text: string): string {
    return text.replaceAll(/\s+/g, ' ').trim()
  }

  private isNestedEditorState(
    value: unknown,
  ): value is { root: { children: any[] } } {
    return (
      !!value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      'root' in value &&
      !!value.root &&
      typeof value.root === 'object' &&
      'children' in value.root &&
      Array.isArray(value.root.children)
    )
  }

  private extractBlockText(node: any): string {
    if (!node) return ''

    if (node.type === 'text') {
      return String(node.text || '')
    }

    if (node.type === 'linebreak') {
      return '\n'
    }

    if (typeof node.code === 'string') {
      return node.code
    }

    const segments: string[] = []

    if (Array.isArray(node.children)) {
      const childText = node.children
        .map((child: any) => this.extractBlockText(child))
        .join('')
      if (childText) {
        segments.push(childText)
      }
    }

    for (const [key, rawValue] of Object.entries(
      node as Record<string, unknown>,
    )) {
      const value = rawValue
      if (KNOWN_STRUCTURAL_PROPS.has(key)) continue

      if (this.isNestedEditorState(value)) {
        const nested = value.root.children
          .map((child: any) => this.extractBlockText(child))
          .join('\n')
        if (nested) {
          segments.push(nested)
        }
        continue
      }

      if (Array.isArray(value)) {
        const nestedSegments: string[] = []
        for (const item of value) {
          if (!this.isNestedEditorState(item)) continue
          const nested = item.root.children
            .map((child: any) => this.extractBlockText(child))
            .join('\n')
          if (nested) {
            nestedSegments.push(nested)
          }
        }
        if (nestedSegments.length) {
          segments.push(nestedSegments.join('\n'))
        }
      }
    }

    return segments.join('\n')
  }

  normalizeBlockIds(content: string): { content: string; changed: boolean } {
    const editorState = this.parseEditorState(content)
    if (!editorState?.root || !Array.isArray(editorState.root.children)) {
      return { content, changed: false }
    }

    let changed = false
    const used = new Set<string>()

    for (const child of editorState.root.children) {
      if (!child || typeof child !== 'object') continue

      let blockId = this.readBlockId(child)
      if (!blockId || used.has(blockId)) {
        blockId = this.createBlockId()
      }

      if (this.writeBlockId(child, blockId)) {
        changed = true
      }

      used.add(blockId)
    }

    return changed
      ? { content: JSON.stringify(editorState), changed: true }
      : { content, changed: false }
  }

  extractRootBlocks(content: string): LexicalRootBlock[] {
    const editorState = this.parseEditorState(content)
    if (!editorState?.root || !Array.isArray(editorState.root.children)) {
      return []
    }

    return editorState.root.children
      .map((child: any, index: number) => {
        if (!child || typeof child !== 'object') {
          return null
        }

        const text = this.extractBlockText(child)
        const normalized = this.normalizeText(text)
        const type = typeof child.type === 'string' ? child.type : 'unknown'
        const fingerprint = md5(`${type}:${normalized}`)

        return {
          id: this.readBlockId(child),
          type,
          text,
          fingerprint,
          index,
        } satisfies LexicalRootBlock
      })
      .filter((block): block is LexicalRootBlock => !!block)
  }

  lexicalToMarkdown(editorState: string): string {
    const editor = createHeadlessEditor({
      nodes: allHeadlessNodes,
      onError: (error) => {
        throw error
      },
    })

    const parsed = editor.parseEditorState(editorState)
    editor.setEditorState(parsed)

    let markdown = ''
    editor.read(() => {
      markdown = $toMarkdown()
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
      const normalized = this.normalizeBlockIds(doc.content)
      if (normalized.changed) {
        doc.content = normalized.content
      }
      doc.text = this.lexicalToMarkdown(doc.content)
      return true
    }
    return false
  }
}
