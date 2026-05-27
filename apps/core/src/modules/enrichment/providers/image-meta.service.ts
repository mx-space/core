import { Injectable, Logger } from '@nestjs/common'
import sharp from 'sharp'
import { rgbaToThumbHash } from 'thumbhash'

const FETCH_TIMEOUT_MS = 5000
const MAX_BYTES = 5 * 1024 * 1024

export interface ImageMeta {
  width?: number
  height?: number
  thumbhash?: string
  palette?: { dominant: string; swatches?: string[] }
}

@Injectable()
export class ImageMetaService {
  private readonly logger = new Logger(ImageMetaService.name)

  async fetchAndExtract(url: string): Promise<ImageMeta | null> {
    try {
      const buffer = await this.fetchBuffer(url)
      if (!buffer) return null
      return await this.extract(buffer)
    } catch (error) {
      this.logger.debug(
        `image-meta: extract failed for ${url}: ${(error as Error).message}`,
      )
      return null
    }
  }

  private async fetchBuffer(url: string): Promise<Buffer | null> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
    try {
      const response = await fetch(url, { signal: controller.signal })
      if (!response.ok || !response.body) {
        this.logger.debug(
          `image-meta: fetch ${url} returned status ${response.status}`,
        )
        return null
      }
      const reader = response.body.getReader()
      const chunks: Uint8Array[] = []
      let total = 0
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        if (value) {
          total += value.byteLength
          if (total > MAX_BYTES) {
            await reader.cancel()
            this.logger.debug(
              `image-meta: fetch ${url} exceeded ${MAX_BYTES} bytes; aborting`,
            )
            return null
          }
          chunks.push(value)
        }
      }
      return Buffer.concat(chunks.map((c) => Buffer.from(c)))
    } finally {
      clearTimeout(timer)
    }
  }

  private async extract(buffer: Buffer): Promise<ImageMeta> {
    const sharped = sharp(buffer)
    const metadata = await sharped.metadata()
    const { dominant } = await sharped.stats()
    const dominantHex = rgbToHex(dominant.r, dominant.g, dominant.b)
    const thumbhash = await encodeThumbhash(sharped)
    return {
      width: metadata.width,
      height: metadata.height,
      thumbhash,
      palette: { dominant: dominantHex },
    }
  }
}

function rgbToHex(r: number, g: number, b: number): string {
  const h = (n: number) =>
    Math.max(0, Math.min(255, Math.round(n)))
      .toString(16)
      .padStart(2, '0')
  return `#${h(r)}${h(g)}${h(b)}`
}

async function encodeThumbhash(source: sharp.Sharp): Promise<string> {
  const { data, info } = await source
    .clone()
    .raw()
    .ensureAlpha()
    .resize(100, 100, { fit: 'inside' })
    .toBuffer({ resolveWithObject: true })
  const u8 = rgbaToThumbHash(info.width, info.height, data)
  return Buffer.from(u8).toString('base64')
}
