import { decode } from 'blurhash'
import sharp from 'sharp'
import { beforeAll, describe, expect, it } from 'vitest'

import { ScreenshotPipelineService } from '~/modules/enrichment/providers/open-graph/screenshot-pipeline.service'

// Fixture images are synthesized at test setup with `sharp` so no binary
// asset needs to live in the repo. The shapes are picked to exercise:
//   - the normal happy path (mixed colors with a clear dominant)
//   - the clamp branch (input larger than 1280x720)
//   - the size-cap branch (a noisy/large image at high quality)

const HEX_RE = /^#[\da-f]{6}$/i

async function makePngBuffer(opts: {
  width: number
  height: number
  background: { r: number; g: number; b: number; alpha: number }
}): Promise<Buffer> {
  return sharp({
    create: {
      width: opts.width,
      height: opts.height,
      channels: 4,
      background: opts.background,
    },
  })
    .png()
    .toBuffer()
}

async function makeMultiColorPng(
  width: number,
  height: number,
): Promise<Buffer> {
  const base = await makePngBuffer({
    width,
    height,
    background: { r: 20, g: 30, b: 200, alpha: 1 },
  })
  // Composite two distinct color stripes so the swatch extractor sees more
  // than one bucket. Stripes occupy ~30% + ~20% of the image.
  const stripeOne = await makePngBuffer({
    width: Math.round(width * 0.3),
    height,
    background: { r: 220, g: 40, b: 40, alpha: 1 },
  })
  const stripeTwo = await makePngBuffer({
    width: Math.round(width * 0.2),
    height,
    background: { r: 40, g: 200, b: 60, alpha: 1 },
  })
  return sharp(base)
    .composite([
      { input: stripeOne, top: 0, left: 0 },
      { input: stripeTwo, top: 0, left: Math.round(width * 0.7) },
    ])
    .png()
    .toBuffer()
}

/**
 * High-entropy per-pixel noise: a seeded LCG drives independent R/G/B bytes
 * so the resulting image has no spatial structure for webp to exploit. Even
 * at q=80 the encoded byte count for 1280x720 sits well above 100, which is
 * what the size-cap test relies on.
 */
async function makeRandomNoisePng(
  width: number,
  height: number,
): Promise<Buffer> {
  const channels = 3
  const data = Buffer.alloc(width * height * channels)
  // Linear congruential generator (Numerical Recipes constants); fast,
  // deterministic, fine for "looks random" image data.
  let state = 0x12345678
  for (let i = 0; i < data.length; i++) {
    state = (Math.imul(state, 1664525) + 1013904223) | 0
    data[i] = (state >>> 16) & 0xff
  }
  return sharp(data, { raw: { width, height, channels } }).png().toBuffer()
}

describe('ScreenshotPipelineService', () => {
  let service: ScreenshotPipelineService
  let multiColor1280: Buffer
  let multiColorLarge: Buffer
  let noisyLarge: Buffer

  beforeAll(async () => {
    service = new ScreenshotPipelineService()
    multiColor1280 = await makeMultiColorPng(1280, 720)
    multiColorLarge = await makeMultiColorPng(2560, 1440)
    noisyLarge = await makeRandomNoisePng(1280, 720)
  })

  it('returns processed screenshot for a normal image', async () => {
    const result = await service.process(multiColor1280, {
      webpQuality: 75,
      maxBytesPerImage: 1024 * 1024,
    })

    expect(result).not.toBeNull()
    expect(result!.webp.length).toBeGreaterThan(0)
    expect(result!.width).toBe(1280)
    expect(result!.height).toBe(720)
    expect(result!.palette.dominant).toMatch(HEX_RE)
    expect(result!.blurhash).toBeTypeOf('string')
    expect(result!.blurhash.length).toBeGreaterThan(0)
  })

  it('clamps oversized input to <=1280 / <=720', async () => {
    const result = await service.process(multiColorLarge, {
      webpQuality: 75,
      maxBytesPerImage: 2 * 1024 * 1024,
    })
    expect(result).not.toBeNull()
    expect(result!.width).toBeLessThanOrEqual(1280)
    expect(result!.height).toBeLessThanOrEqual(720)
  })

  it('extracts swatches as #RRGGBB strings', async () => {
    const result = await service.process(multiColor1280, {
      webpQuality: 75,
      maxBytesPerImage: 1024 * 1024,
    })
    expect(result).not.toBeNull()
    const swatches = result!.palette.swatches ?? []
    expect(swatches.length).toBeGreaterThan(0)
    for (const s of swatches) {
      expect(s).toMatch(HEX_RE)
    }
  })

  it('produces a blurhash that decodes to a non-trivial canvas', async () => {
    const result = await service.process(multiColor1280, {
      webpQuality: 75,
      maxBytesPerImage: 1024 * 1024,
    })
    expect(result).not.toBeNull()
    const decoded = decode(result!.blurhash, 32, 32)
    // 32 * 32 RGBA = 4096 bytes
    expect(decoded).toBeInstanceOf(Uint8ClampedArray)
    expect(decoded.length).toBe(32 * 32 * 4)
    const nonZero = decoded.some((v) => v !== 0)
    expect(nonZero).toBe(true)
  })

  it('returns null when even the retry-quality webp exceeds the byte cap', async () => {
    // 1280x720 of LCG noise will not compress under 100 bytes at q=95 nor
    // at the retry q=80, so the pipeline must drop the screenshot. This
    // is the deterministic null branch and the warn log path.
    const result = await service.process(noisyLarge, {
      webpQuality: 95,
      maxBytesPerImage: 100,
    })
    expect(result).toBeNull()
  })
})
