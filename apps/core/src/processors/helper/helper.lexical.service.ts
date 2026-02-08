import { CodeNode } from '@lexical/code'
import { createHeadlessEditor } from '@lexical/headless'
import { AutoLinkNode, LinkNode } from '@lexical/link'
import { ListItemNode, ListNode } from '@lexical/list'
import { $convertToMarkdownString, TRANSFORMERS } from '@lexical/markdown'
import { HeadingNode, QuoteNode } from '@lexical/rich-text'
import { Injectable } from '@nestjs/common'
import { ContentFormat } from '~/shared/types/content-format.type'
import type { Klass, LexicalNode } from 'lexical'

const EDITOR_NODES: Klass<LexicalNode>[] = [
  HeadingNode,
  QuoteNode,
  ListNode,
  ListItemNode,
  CodeNode,
  LinkNode,
  AutoLinkNode,
]

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
      markdown = $convertToMarkdownString(TRANSFORMERS)
    })

    return markdown
  }

  /**
   * 若文档为 Lexical 格式且 content 存在，则用 content 生成降级 Markdown 写入 text。
   * 原地修改，返回是否执行了降级。
   */
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
