import { Injectable, Logger } from '@nestjs/common'
import { encode } from 'blurhash'
import sharp from 'sharp'

export interface ScreenshotPalette {
  dominant: string // #RRGGBB
  swatches?: string[] // top distinct, optional, up to 3
}

export interface ProcessedScreenshot {
  webp: Buffer
  width: number
  height: number
  blurhash: string
  palette: ScreenshotPalette
}

const MAX_WIDTH = 1280
const MAX_HEIGHT = 720

// Distance-filter swatches in 0-255 RGB space; threshold picked to keep three
// visibly distinct colors and avoid near-duplicates collapsing the list.
const SWATCH_DISTINCT_DISTANCE = 32

// Histogram bucket: 5 bits per channel → 32 bins per channel, 32k bins total.
const SWATCH_BUCKET_BITS = 5
const SWATCH_BUCKETS_PER_CHANNEL = 1 << SWATCH_BUCKET_BITS // 32
const SWATCH_BUCKET_SIZE = 256 / SWATCH_BUCKETS_PER_CHANNEL // 8
const SWATCH_DOWNSCALE = 64
const SWATCH_TOP_COUNT = 3

// Blurhash sample size mirrors `helper.image.service.ts`.
const BLURHASH_SIZE = 32
const BLURHASH_COMP_X = 4
const BLURHASH_COMP_Y = 4

// Single retry, lower quality, before dropping the screenshot entirely.
const QUALITY_RETRY_STEP = 15

interface ProcessOptions {
  webpQuality: number
  maxBytesPerImage: number
}

@Injectable()
export class ScreenshotPipelineService {
  private readonly logger = new Logger(ScreenshotPipelineService.name)

  async process(
    input: Buffer,
    opts: ProcessOptions,
  ): Promise<ProcessedScreenshot | null> {
    // Reused sharp instance for everything except the swatch/blurhash clones,
    // which need their own raw pipelines. Note that `.metadata()` on a
    // pipeline reflects the SOURCE image, not the resized output — so we
    // capture the post-resize dimensions from the webp encode's
    // `resolveWithObject` info instead.
    const sharped = sharp(input).resize(MAX_WIDTH, MAX_HEIGHT, {
      fit: 'inside',
      withoutEnlargement: true,
    })

    const { dominant } = await sharped.stats()
    const dominantHex = rgbToHex(dominant.r, dominant.g, dominant.b)

    const swatches = await extractSwatches(sharped)
    const palette: ScreenshotPalette = swatches.length
      ? { dominant: dominantHex, swatches }
      : { dominant: dominantHex }

    const blurhash = await encodeBlurhash(sharped)

    const encoded = await encodeWebpWithRetry(
      sharped,
      opts.webpQuality,
      opts.maxBytesPerImage,
    )
    if (!encoded) {
      this.logger.warn(
        `screenshot pipeline: bytes exceed cap ${opts.maxBytesPerImage} after retry; dropping screenshot`,
      )
      return null
    }

    const { data: webp, info } = encoded
    const width = info.width
    const height = info.height
    if (!width || !height) {
      this.logger.debug('screenshot pipeline: missing webp output dimensions')
      return null
    }

    return { webp, width, height, blurhash, palette }
  }
}

function rgbToHex(r: number, g: number, b: number): string {
  const h = (n: number) =>
    Math.max(0, Math.min(255, Math.round(n)))
      .toString(16)
      .padStart(2, '0')
  return `#${h(r)}${h(g)}${h(b)}`
}

/**
 * Histogram-bucket a 64x64 downscale into 5-bit-per-channel bins, then pick
 * the top-3 buckets that survive a Euclidean-distance filter (>=32 in 0-255
 * space) so swatches do not collapse into near-duplicates.
 *
 * If fewer than 3 distinct colors survive, returns whatever exists (callers
 * MUST tolerate a shorter array). Returns `[]` for fully-degenerate input.
 */
async function extractSwatches(source: sharp.Sharp): Promise<string[]> {
  const { data, info } = await source
    .clone()
    .removeAlpha()
    .resize(SWATCH_DOWNSCALE, SWATCH_DOWNSCALE, { fit: 'inside' })
    .raw()
    .toBuffer({ resolveWithObject: true })

  const channels = info.channels // 3 after removeAlpha
  if (channels !== 3) return []

  const counts = new Map<number, number>()
  for (let i = 0; i < data.length; i += channels) {
    const rb = data[i] >> (8 - SWATCH_BUCKET_BITS)
    const gb = data[i + 1] >> (8 - SWATCH_BUCKET_BITS)
    const bb = data[i + 2] >> (8 - SWATCH_BUCKET_BITS)
    const key =
      (rb << (SWATCH_BUCKET_BITS * 2)) | (gb << SWATCH_BUCKET_BITS) | bb
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }

  if (counts.size === 0) return []

  const ranked = Array.from(counts.entries()).sort((a, b) => b[1] - a[1])

  const picked: Array<{ r: number; g: number; b: number }> = []
  for (const [key] of ranked) {
    const rb =
      (key >> (SWATCH_BUCKET_BITS * 2)) & (SWATCH_BUCKETS_PER_CHANNEL - 1)
    const gb = (key >> SWATCH_BUCKET_BITS) & (SWATCH_BUCKETS_PER_CHANNEL - 1)
    const bb = key & (SWATCH_BUCKETS_PER_CHANNEL - 1)
    // Bucket center: shift up + half-bucket bias.
    const r = rb * SWATCH_BUCKET_SIZE + Math.floor(SWATCH_BUCKET_SIZE / 2)
    const g = gb * SWATCH_BUCKET_SIZE + Math.floor(SWATCH_BUCKET_SIZE / 2)
    const b = bb * SWATCH_BUCKET_SIZE + Math.floor(SWATCH_BUCKET_SIZE / 2)
    const tooClose = picked.some(
      (p) =>
        euclideanDistance(p.r, p.g, p.b, r, g, b) < SWATCH_DISTINCT_DISTANCE,
    )
    if (tooClose) continue
    picked.push({ r, g, b })
    if (picked.length >= SWATCH_TOP_COUNT) break
  }

  return picked.map((p) => rgbToHex(p.r, p.g, p.b))
}

function euclideanDistance(
  r1: number,
  g1: number,
  b1: number,
  r2: number,
  g2: number,
  b2: number,
): number {
  const dr = r1 - r2
  const dg = g1 - g2
  const db = b1 - b2
  return Math.sqrt(dr * dr + dg * dg + db * db)
}

async function encodeBlurhash(source: sharp.Sharp): Promise<string> {
  const { data, info } = await source
    .clone()
    .raw()
    .ensureAlpha()
    .resize(BLURHASH_SIZE, BLURHASH_SIZE, { fit: 'inside' })
    .toBuffer({ resolveWithObject: true })
  return encode(
    new Uint8ClampedArray(data),
    info.width,
    info.height,
    BLURHASH_COMP_X,
    BLURHASH_COMP_Y,
  )
}

async function encodeWebpWithRetry(
  source: sharp.Sharp,
  quality: number,
  maxBytes: number,
): Promise<{ data: Buffer; info: sharp.OutputInfo } | null> {
  const first = await source
    .clone()
    .webp({ quality })
    .toBuffer({ resolveWithObject: true })
  if (first.data.length <= maxBytes) return first

  const retryQuality = Math.max(1, quality - QUALITY_RETRY_STEP)
  const second = await source
    .clone()
    .webp({ quality: retryQuality })
    .toBuffer({ resolveWithObject: true })
  if (second.data.length <= maxBytes) return second

  return null
}
