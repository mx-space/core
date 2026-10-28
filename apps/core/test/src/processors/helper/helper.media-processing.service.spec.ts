import { execFileSync, spawnSync } from 'node:child_process'
import { access, mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { Readable } from 'node:stream'

import sharp from 'sharp'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { AppErrorCode } from '~/common/errors'
import { AppException } from '~/common/errors/exception.types'
import { generateDefaultConfig } from '~/modules/configs/configs.default'
import { MediaProcessingService } from '~/processors/helper/helper.media-processing.service'

type MediaOptions = ReturnType<
  typeof generateDefaultConfig
>['mediaProcessingOptions']

const createService = (overrides: Partial<MediaOptions> = {}) =>
  new MediaProcessingService({
    get: vi.fn(async (key: string) => {
      if (key === 'mediaProcessingOptions') {
        return {
          ...generateDefaultConfig().mediaProcessingOptions,
          ...overrides,
        }
      }
      throw new Error(`Unexpected config key: ${key}`)
    }),
  } as any)

const png = (width: number, height: number) =>
  sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 200, g: 40, b: 40 },
    },
  })
    .png()
    .toBuffer()

const hasFfmpeg = spawnSync('ffmpeg', ['-version']).status === 0

describe('MediaProcessingService.processImage', () => {
  it('returns null when WebP conversion is disabled', async () => {
    const service = createService({ imageToWebp: false })

    const result = await service.processImage(await png(10, 10), 'a.png')

    expect(result).toBeNull()
  })

  it('converts a PNG to WebP and renames it', async () => {
    const service = createService({ imageToWebp: true })

    const result = await service.processImage(await png(32, 16), 'photo.png')

    expect(result?.filename).toBe('photo.webp')
    expect(result?.contentType).toBe('image/webp')
    const meta = await sharp(result!.buffer).metadata()
    expect(meta.format).toBe('webp')
    expect([meta.width, meta.height]).toEqual([32, 16])
  })

  it('applies the configured quality', async () => {
    const noisy = await sharp(
      Buffer.from(
        Array.from({ length: 128 * 128 * 3 }, (_, i) => (i * 7919) % 256),
      ),
      { raw: { width: 128, height: 128, channels: 3 } },
    )
      .png()
      .toBuffer()

    const low = await createService({
      imageToWebp: true,
      imageQuality: 10,
    }).processImage(noisy, 'n.png')
    const high = await createService({
      imageToWebp: true,
      imageQuality: 95,
    }).processImage(noisy, 'n.png')

    expect(low!.buffer.length).toBeLessThan(high!.buffer.length)
  })

  it('shrinks images whose longest edge exceeds the max dimension', async () => {
    const service = createService({
      imageToWebp: true,
      imageMaxDimension: 50,
    })

    const result = await service.processImage(await png(200, 100), 'w.png')

    const meta = await sharp(result!.buffer).metadata()
    expect([meta.width, meta.height]).toEqual([50, 25])
  })

  it('does not enlarge images smaller than the max dimension', async () => {
    const service = createService({
      imageToWebp: true,
      imageMaxDimension: 500,
    })

    const result = await service.processImage(await png(20, 10), 's.png')

    const meta = await sharp(result!.buffer).metadata()
    expect([meta.width, meta.height]).toEqual([20, 10])
  })

  it('keeps every frame of an animated GIF', async () => {
    const raw = Buffer.alloc(8 * 24 * 4, 255)
    for (let px = 0; px < 8 * 24; px++) {
      raw[px * 4] = Math.floor(px / 64) * 100
    }
    const animated = await sharp(raw, {
      raw: { width: 8, height: 24, channels: 4, pageHeight: 8 },
    })
      .gif({ loop: 0 })
      .toBuffer()
    const service = createService({ imageToWebp: true })

    const result = await service.processImage(animated, 'anim.gif')

    const meta = await sharp(result!.buffer, { animated: true }).metadata()
    expect(meta.format).toBe('webp')
    expect(meta.pages).toBe(3)
  })

  it.each(['icon.svg', 'already.webp'])(
    'leaves %s untouched',
    async (filename) => {
      const service = createService({ imageToWebp: true })

      const result = await service.processImage(await png(4, 4), filename)

      expect(result).toBeNull()
    },
  )

  it('returns null when the image cannot be decoded', async () => {
    const service = createService({ imageToWebp: true })

    const result = await service.processImage(
      Buffer.from('not an image'),
      'broken.png',
    )

    expect(result).toBeNull()
  })
})

describe('MediaProcessingService.transcodeVideo', () => {
  let fixtureDir: string
  let sourceMp4: string

  beforeAll(async () => {
    fixtureDir = await mkdtemp(path.join(tmpdir(), 'byline-media-spec-'))
    sourceMp4 = path.join(fixtureDir, 'source.mp4')
    if (hasFfmpeg) {
      execFileSync('ffmpeg', [
        '-y',
        '-f',
        'lavfi',
        '-i',
        'testsrc=size=320x240:rate=10:duration=1',
        '-f',
        'lavfi',
        '-i',
        'sine=frequency=440:duration=1',
        '-c:v',
        'libx264',
        '-pix_fmt',
        'yuv420p',
        '-c:a',
        'aac',
        '-shortest',
        sourceMp4,
      ])
    }
  })

  afterAll(async () => {
    await rm(fixtureDir, { recursive: true, force: true })
  })

  it('returns null without reading the stream when disabled', async () => {
    const service = createService({ videoToWebm: false })
    const stream = Readable.from([Buffer.from('video')])

    const result = await service.transcodeVideo(stream, 'clip.mp4')

    expect(result).toBeNull()
    expect(stream.readableEnded).toBe(false)
  })

  it('returns null for a video that is already WebM', async () => {
    const service = createService({ videoToWebm: true })

    const result = await service.transcodeVideo(
      Readable.from([Buffer.from('video')]),
      'clip.webm',
    )

    expect(result).toBeNull()
  })

  it('rejects a truncated upload as too large', async () => {
    const service = createService({ videoToWebm: true })
    const stream = Object.assign(Readable.from([Buffer.from('partial')]), {
      truncated: true,
    })

    const error = await service
      .transcodeVideo(stream, 'clip.mp4')
      .catch((error_) => error_)

    expect(error).toBeInstanceOf(AppException)
    expect(error.code).toBe(AppErrorCode.FILE_TOO_LARGE)
  })

  it('fails with a transcode error when ffmpeg is missing', async () => {
    vi.stubEnv('PATH', '')
    try {
      const service = createService({ videoToWebm: true })

      const error = await service
        .transcodeVideo(Readable.from([Buffer.from('video')]), 'clip.mp4')
        .catch((error_) => error_)

      expect(error).toBeInstanceOf(AppException)
      expect(error.code).toBe(AppErrorCode.MEDIA_TRANSCODE_FAILED)
    } finally {
      vi.unstubAllEnvs()
    }
  })

  it.skipIf(!hasFfmpeg)(
    'fails with a transcode error when the input is not a video',
    async () => {
      const service = createService({ videoToWebm: true })

      const error = await service
        .transcodeVideo(Readable.from([Buffer.from('garbage')]), 'clip.mp4')
        .catch((error_) => error_)

      expect(error).toBeInstanceOf(AppException)
      expect(error.code).toBe(AppErrorCode.MEDIA_TRANSCODE_FAILED)
    },
  )

  it.skipIf(!hasFfmpeg)(
    'transcodes an MP4 into a scaled VP9/Opus WebM and cleans up',
    async () => {
      const service = createService({
        videoToWebm: true,
        videoCpuUsed: 8,
        videoMaxHeight: 120,
      })

      const result = await service.transcodeVideo(
        Readable.from(await readFile(sourceMp4)),
        'clip.mp4',
      )

      expect(result?.filename).toBe('clip.webm')
      expect(result?.contentType).toBe('video/webm')
      const probe = JSON.parse(
        execFileSync('ffprobe', [
          '-v',
          'error',
          '-show_streams',
          '-of',
          'json',
          result!.path,
        ]).toString(),
      ) as {
        streams: Array<{ codec_name: string; width?: number; height?: number }>
      }
      const video = probe.streams.find((s) => s.codec_name === 'vp9')
      expect(video).toMatchObject({ width: 160, height: 120 })
      expect(probe.streams.some((s) => s.codec_name === 'opus')).toBe(true)

      await result!.cleanup()
      await expect(access(result!.path)).rejects.toThrow()
    },
    60_000,
  )
})
