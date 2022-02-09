import getColors from 'get-image-colors'
import { marked } from 'marked'

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
  type: string,
): Promise<string | undefined> {
  if (!buffer) {
    return undefined
  }

  try {
    const colors = await getColors(buffer, type)

    return colors[0].hex()
  } catch (err) {
    console.error(err.message)
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
