import { marked } from 'marked'

import Vibrant = require('node-vibrant')

export const pickImagesFromMarkdown = (text: string) => {
  const ast = marked.lexer(text)
  const images = [] as string[]
  function pickImage(node: any) {
    if (node.type === 'image') {
      images.push(node.href)
      return
    }
    if (node.tokens && Array.isArray(node.tokens)) {
      return node.tokens.forEach(pickImage)
    }
  }
  ast.forEach(pickImage)
  return images
}

export async function getAverageRGB(
  buffer: Buffer,
): Promise<string | undefined> {
  if (!buffer) {
    return undefined
  }
  try {
    const res = await Vibrant.from(buffer).getPalette()

    return res.Muted.hex
  } catch {
    return undefined
  }
}

function componentToHex(c: number) {
  const hex = c.toString(16)
  return hex.length == 1 ? '0' + hex : hex
}

export function rgbToHex({ r, g, b }: { r: number; g: number; b: number }) {
  return '#' + componentToHex(r) + componentToHex(g) + componentToHex(b)
}
