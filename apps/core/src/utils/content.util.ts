import { ContentFormat } from '~/shared/types/content-format.type'
import { pickImagesFromMarkdown } from './pic.util'
import { md5 } from './tool.util'

interface ContentDoc {
  text: string
  title: string
  contentFormat?: ContentFormat | string
  content?: string
  summary?: string | null
  tags?: string[]
}

export function isLexical(doc: Pick<ContentDoc, 'contentFormat'>): boolean {
  return doc.contentFormat === ContentFormat.Lexical
}

export function extractImagesFromContent(doc: ContentDoc): string[] {
  if (!isLexical(doc)) {
    return pickImagesFromMarkdown(doc.text)
  }

  if (!doc.content) return []

  try {
    const editorState = JSON.parse(doc.content)
    const images: string[] = []
    traverseLexicalNodes(editorState.root, (node) => {
      if (node.type === 'image' && node.src) {
        images.push(node.src)
      }
    })
    return images
  } catch {
    return []
  }
}

export function getTranslationPayload(doc: ContentDoc): {
  format: string
  title: string
  text?: string
  content?: string
} {
  if (isLexical(doc)) {
    return { format: 'lexical', title: doc.title, content: doc.content }
  }
  return { format: 'markdown', title: doc.title, text: doc.text }
}

export function computeContentHash(
  doc: ContentDoc,
  sourceLang: string,
): string {
  const sourceOfTruth = isLexical(doc) ? doc.content : doc.text
  return md5(
    JSON.stringify({
      title: doc.title,
      content: sourceOfTruth,
      summary: doc.summary,
      tags: doc.tags,
      sourceLang,
    }),
  )
}

function traverseLexicalNodes(node: any, visitor: (node: any) => void): void {
  if (!node) return
  visitor(node)
  if (Array.isArray(node.children)) {
    for (const child of node.children) {
      traverseLexicalNodes(child, visitor)
    }
  }
}
