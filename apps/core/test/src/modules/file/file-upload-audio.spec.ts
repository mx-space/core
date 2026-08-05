import { access } from 'node:fs/promises'
import { Readable } from 'node:stream'

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { FileService } from '~/modules/file/file.service'

const { uploadBufferMock, deleteObjectMock, setCustomDomainMock } = vi.hoisted(
  () => ({
    uploadBufferMock: vi.fn(),
    deleteObjectMock: vi.fn(),
    setCustomDomainMock: vi.fn(),
  }),
)

vi.mock('~/utils/s3.util', () => ({
  S3Uploader: vi.fn(function (this: Record<string, unknown>) {
    this.uploadBuffer = uploadBufferMock
    this.deleteObject = deleteObjectMock
    this.setCustomDomain = setCustomDomainMock
  }),
}))

function createService(overrides: { s3Enabled: boolean; prefix?: string }) {
  const configService = {
    get: vi.fn(async (key: string) => {
      if (key === 'fileUploadOptions') {
        return {
          enableCustomNaming: true,
          filenameTemplate: '{name}{ext}',
          pathTemplate: '{type}',
        }
      }
      if (key === 'imageStorageOptions') {
        return {
          enable: overrides.s3Enabled,
          endpoint: 'https://s3.example.com',
          secretId: 'id',
          secretKey: 'key',
          bucket: 'bucket',
          region: 'auto',
          prefix: overrides.prefix ?? '',
          customDomain: '',
        }
      }
      if (key === 'url') return { serverUrl: 'https://example.com' }
      return {}
    }),
  }
  const fileReferenceService = { createPendingReference: vi.fn() }
  const service = new FileService(
    configService as any,
    fileReferenceService as any,
  )
  vi.spyOn(service, 'writeFile').mockResolvedValue(undefined as any)
  return { service, fileReferenceService }
}

beforeEach(() => {
  uploadBufferMock.mockReset()
  deleteObjectMock.mockReset()
  setCustomDomainMock.mockReset()
})

describe('FileService.uploadBuffer audio on the local backend', () => {
  it('uses the explicit objectKey instead of the filename template', async () => {
    const { service } = createService({ s3Enabled: false })
    const result = await service.uploadBuffer(Buffer.from('x'), {
      type: 'audio',
      contentType: 'audio/mpeg',
      objectKey: 'tts/1/zh/blk-0-abcdef123456.mp3',
    })

    expect(result.storageBackend).toBe('local')
    expect(result.storageKey).toBe('tts/1/zh/blk-0-abcdef123456.mp3')
    expect(result.url).toBe(
      'https://example.com/objects/audio/tts/1/zh/blk-0-abcdef123456.mp3',
    )
  })

  it('creates the pending reference the orphan system tracks the audio by', async () => {
    const { service, fileReferenceService } = createService({
      s3Enabled: false,
    })
    await service.uploadBuffer(Buffer.from('x'), {
      type: 'audio',
      contentType: 'audio/mpeg',
      objectKey: 'tts/1/zh/blk-0-abcdef123456.mp3',
    })

    expect(fileReferenceService.createPendingReference).toHaveBeenCalledWith(
      'https://example.com/objects/audio/tts/1/zh/blk-0-abcdef123456.mp3',
      'tts/1/zh/blk-0-abcdef123456.mp3',
    )
  })

  it('rejects a repeat write of the same object key so the caller can treat it as already stored', async () => {
    const { service } = createService({ s3Enabled: false })
    vi.mocked(service.writeFile).mockRestore()
    const objectKey = `tts/file-exists-${Date.now()}/a.mp3`
    const upload = () =>
      service.uploadBuffer(Buffer.from('x'), {
        type: 'audio',
        contentType: 'audio/mpeg',
        objectKey,
      })

    await upload()

    await expect(upload()).rejects.toMatchObject({ code: 'FILE_EXISTS' })

    await service.deleteObject('local', objectKey)
  })
})

describe('FileService.uploadBuffer audio on the s3 backend', () => {
  it('uploads the explicit objectKey and references it by basename', async () => {
    const { service, fileReferenceService } = createService({
      s3Enabled: true,
      prefix: 'blog',
    })
    uploadBufferMock.mockResolvedValue(
      'https://cdn.example.com/tts/1/zh/blk-0-abcdef123456.mp3',
    )

    const result = await service.uploadBuffer(Buffer.from('x'), {
      type: 'audio',
      contentType: 'audio/mpeg',
      objectKey: 'blog/tts/1/zh/blk-0-abcdef123456.mp3',
    })

    expect(uploadBufferMock).toHaveBeenCalledWith(
      expect.any(Buffer),
      'blog/tts/1/zh/blk-0-abcdef123456.mp3',
      'audio/mpeg',
    )
    expect(result).toEqual({
      url: 'https://cdn.example.com/tts/1/zh/blk-0-abcdef123456.mp3',
      name: 'blk-0-abcdef123456.mp3',
      storageBackend: 's3',
      storageKey: 'blog/tts/1/zh/blk-0-abcdef123456.mp3',
    })
    expect(fileReferenceService.createPendingReference).toHaveBeenCalledWith(
      'https://cdn.example.com/tts/1/zh/blk-0-abcdef123456.mp3',
      'blk-0-abcdef123456.mp3',
      'blog/tts/1/zh/blk-0-abcdef123456.mp3',
    )
  })

  it('rejects when the bucket credentials are incomplete', async () => {
    const configService = {
      get: vi.fn(async (key: string) => {
        if (key === 'imageStorageOptions') {
          return { enable: true, endpoint: '', secretId: '', secretKey: '' }
        }
        return {}
      }),
    }
    const service = new FileService(
      configService as any,
      { createPendingReference: vi.fn() } as any,
    )

    await expect(
      service.uploadBuffer(Buffer.from('x'), {
        type: 'audio',
        contentType: 'audio/mpeg',
        objectKey: 'tts/1/zh/a.mp3',
      }),
    ).rejects.toMatchObject({ code: 'FILE_STORAGE_NOT_CONFIGURED' })
    expect(uploadBufferMock).not.toHaveBeenCalled()
  })
})

describe('FileService.deleteObject', () => {
  it('removes a local audio object', async () => {
    const { service } = createService({ s3Enabled: false })
    vi.mocked(service.writeFile).mockRestore()
    const objectKey = `tts/delete-${Date.now()}/a.mp3`
    await service.writeFile('audio', objectKey, Readable.from(Buffer.from('x')))

    await service.deleteObject('local', objectKey)

    await expect(
      access(service['resolveFilePath']('audio', objectKey)),
    ).rejects.toThrow()
  })

  it('treats a missing local object as already deleted', async () => {
    const { service } = createService({ s3Enabled: false })

    await expect(
      service.deleteObject('local', 'tts/absent/a.mp3'),
    ).resolves.toBeUndefined()
  })

  it('forwards an s3 key to the bucket', async () => {
    const { service } = createService({ s3Enabled: true })
    deleteObjectMock.mockResolvedValue(undefined)

    await service.deleteObject('s3', 'blog/tts/1/zh/a.mp3')

    expect(deleteObjectMock).toHaveBeenCalledWith('blog/tts/1/zh/a.mp3')
  })

  it('rejects an s3 delete when the bucket is not configured', async () => {
    const configService = {
      get: vi.fn(async () => ({ endpoint: '', secretId: '', secretKey: '' })),
    }
    const service = new FileService(
      configService as any,
      { createPendingReference: vi.fn() } as any,
    )

    await expect(
      service.deleteObject('s3', 'blog/tts/1/zh/a.mp3'),
    ).rejects.toMatchObject({ code: 'FILE_STORAGE_NOT_CONFIGURED' })
    expect(deleteObjectMock).not.toHaveBeenCalled()
  })
})
