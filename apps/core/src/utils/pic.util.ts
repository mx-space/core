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

function componentToHex(c: number) {
  const hex = c.toString(16)
  return hex.length == 1 ? `0${hex}` : hex
}

export function rgbToHex({ r, g, b }: { r: number; g: number; b: number }) {
  return `#${componentToHex(r)}${componentToHex(g)}${componentToHex(b)}`
}
