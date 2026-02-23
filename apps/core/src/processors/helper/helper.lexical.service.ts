import { $toMarkdown, allHeadlessNodes } from '@haklex/rich-headless'
import { createHeadlessEditor } from '@lexical/headless'
import { Injectable } from '@nestjs/common'
import { ContentFormat } from '~/shared/types/content-format.type'

@Injectable()
export class LexicalService {
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
      doc.text = this.lexicalToMarkdown(doc.content)
      return true
    }
    return false
  }
}
