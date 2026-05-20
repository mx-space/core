import sharp from 'sharp'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ImageMetaService } from '~/modules/enrichment/providers/image-meta.service'

async function makePngBuffer(width = 32, height = 32): Promise<Buffer> {
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 200, g: 100, b: 50 },
    },
  })
    .png()
    .toBuffer()
}

function makeFetchResponse(body: Uint8Array, status = 200): Response {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(body)
      controller.close()
    },
  })
  return new Response(stream, { status })
}

describe('ImageMetaService', () => {
  let service: ImageMetaService
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    service = new ImageMetaService()
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    vi.restoreAllMocks()
  })

  it('returns width/height/blurhash/dominant palette for a valid image', async () => {
    const buffer = await makePngBuffer()
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(makeFetchResponse(new Uint8Array(buffer)))

    const meta = await service.fetchAndExtract('https://example.test/img.png')

    expect(meta).not.toBeNull()
    expect(meta!.width).toBe(32)
    expect(meta!.height).toBe(32)
    expect(typeof meta!.blurhash).toBe('string')
    expect(meta!.blurhash!.length).toBeGreaterThan(0)
    expect(meta!.palette?.dominant).toMatch(/^#[\da-f]{6}$/)
  })

  it('returns null on non-OK fetch status', async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(new Response('not found', { status: 404 }))

    const meta = await service.fetchAndExtract(
      'https://example.test/missing.png',
    )

    expect(meta).toBeNull()
  })

  it('returns null when fetch throws (network error / timeout)', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('network down'))

    const meta = await service.fetchAndExtract('https://example.test/x.png')

    expect(meta).toBeNull()
  })

  it('returns null when buffer is not decodable by sharp', async () => {
    const garbage = new Uint8Array([0, 1, 2, 3, 4, 5])
    globalThis.fetch = vi.fn().mockResolvedValue(makeFetchResponse(garbage))

    const meta = await service.fetchAndExtract('https://example.test/bad.png')

    expect(meta).toBeNull()
  })
})
