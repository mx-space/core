import Vibrant = require('node-vibrant')
import { ISizeCalculationResult } from 'image-size/dist/types/interface'

export const pickImagesFromMarkdown = (text: string) => {
  const reg = /(?<=\!\[.*\]\()(.+)(?=\))/g
  const images = [] as string[]
  for (const r of text.matchAll(reg)) {
    images.push(r[0])
  }
  return images
}

export async function getAverageRGB(
  buffer: Buffer,
  size: ISizeCalculationResult,
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
