import type { Readable } from 'node:stream'

import sharp from 'sharp'
import { beforeAll, describe, expect, it, vi } from 'vitest'

import { AppErrorCode } from '~/common/errors'
import { CommentUploadService } from '~/modules/file/comment-upload.service'

let png: Buffer

beforeAll(async () => {
  png = await sharp({
    create: {
      width: 4,
      height: 4,
      channels: 3,
      background: { r: 10, g: 20, b: 30 },
    },
  })
    .png()
    .toBuffer()
})

const createService = (processImage: ReturnType<typeof vi.fn>) => {
  const stored = new Map<string, Buffer>()
  const fileService = {
    writeFile: vi.fn(async (_type: string, name: string, stream: Readable) => {
      const chunks: Buffer[] = []
      for await (const chunk of stream) chunks.push(chunk as Buffer)
      stored.set(name, Buffer.concat(chunks))
    }),
    resolveFileUrl: vi.fn(
      async (_type: string, name: string) => `https://blog.example/${name}`,
    ),
  }
  const fileReferenceService = {
    createReaderPendingReference: vi.fn().mockResolvedValue(undefined),
  }
  const configsService = {
    get: vi.fn(async (key: string) => {
      if (key === 'commentUploadOptions') return {}
      if (key === 'fileUploadOptions') return { enableCustomNaming: false }
      if (key === 'imageStorageOptions') return { enable: false }
      throw new Error(`Unexpected config key: ${key}`)
    }),
  }
  const service = new CommentUploadService(
    fileReferenceService as any,
    configsService as any,
    fileService as any,
    { processImage } as any,
  )
  return { service, stored, fileReferenceService }
}

describe('CommentUploadService.uploadForReader media processing', () => {
  it('stores the WebP output when image conversion is on', async () => {
    const webp = Buffer.from('converted-webp')
    const processImage = vi.fn().mockResolvedValue({
      buffer: webp,
      filename: 'upload.webp',
      contentType: 'image/webp',
    })
    const { service, stored, fileReferenceService } =
      createService(processImage)

    const result = await service.uploadForReader(
      { buffer: png, size: png.length } as any,
      'reader-1',
    )

    expect(processImage).toHaveBeenCalledWith(png, 'upload.png', {
      stripMetadata: true,
    })
    const [[name, bytes]] = [...stored.entries()]
    expect(name).toMatch(/^comments\/reader-1\/\d{4}\/\d{2}\/.+\.webp$/)
    expect(bytes.toString()).toBe('converted-webp')
    expect(result).toMatchObject({
      fileName: name,
      mimeType: 'image/webp',
      byteSize: webp.length,
    })
    expect(
      fileReferenceService.createReaderPendingReference,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        fileName: name,
        mimeType: 'image/webp',
        byteSize: webp.length,
      }),
    )
  })

  it('stores the original image when conversion is skipped', async () => {
    const { service, stored } = createService(vi.fn().mockResolvedValue(null))

    const result = await service.uploadForReader(
      { buffer: png, size: png.length } as any,
      'reader-1',
    )

    const [[name, bytes]] = [...stored.entries()]
    expect(name).toMatch(/\.png$/)
    expect(bytes.equals(png)).toBe(true)
    expect(result).toMatchObject({
      mimeType: 'image/png',
      byteSize: png.length,
    })
  })

  it('rejects a disallowed file before converting it', async () => {
    const processImage = vi.fn()
    const { service } = createService(processImage)
    const pdf = Buffer.from('%PDF-1.4\n%âãÏÓ\n1 0 obj\n<<>>\nendobj\n')

    const error = await service
      .uploadForReader({ buffer: pdf, size: pdf.length } as any, 'reader-1')
      .catch((error_) => error_)

    expect(error.code).toBe(AppErrorCode.COMMENT_UPLOAD_INVALID_MIME)
    expect(processImage).not.toHaveBeenCalled()
  })
})
