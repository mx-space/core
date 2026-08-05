import { marked } from 'marked'

const isVideoExts = ['.mp4', '.webm', '.ogg', '.mov', '.avi', '.flv', '.mkv']
export const pickImagesFromMarkdown = (text: string) => {
  const ast = marked.lexer(text)
  const images = [] as string[]
  function pickImage(node: any) {
    if (node.type === 'image') {
      if (isVideoExts.some((ext) => node.href.endsWith(ext))) {
        return
      }
      images.push(node.href)
      return
    }
    if (node.tokens && Array.isArray(node.tokens)) {
      return node.tokens.forEach((element) => {
        pickImage(element)
      })
    }
  }
  ast.forEach((element) => {
    pickImage(element)
  })
  return images
}

/**
 * Collect file-like destinations from Markdown links and images. The caller
 * can safely pass external URLs as well: file reference activation still
 * matches against tracked upload URLs before mutating any records.
 */
export const pickFilesFromMarkdown = (text: string): string[] => {
  const ast = marked.lexer(text)
  const urls: string[] = []
  const visited = new WeakSet<object>()

  const visit = (value: unknown) => {
    if (!value || typeof value !== 'object') return
    if (visited.has(value)) return
    visited.add(value)

    if (Array.isArray(value)) {
      for (const item of value) visit(item)
      return
    }

    const token = value as Record<string, unknown>
    if (
      (token.type === 'image' || token.type === 'link') &&
      typeof token.href === 'string' &&
      token.href.trim()
    ) {
      urls.push(token.href.trim())
    }

    for (const nested of Object.values(token)) {
      if (nested && typeof nested === 'object') visit(nested)
    }
  }

  visit(ast)
  return [...new Set(urls)]
}

function componentToHex(c: number) {
  const hex = c.toString(16)
  return hex.length == 1 ? `0${hex}` : hex
}

export function rgbToHex({ r, g, b }: { r: number; g: number; b: number }) {
  return `#${componentToHex(r)}${componentToHex(g)}${componentToHex(b)}`
}
