import { copyFile, mkdir, unlink } from 'node:fs/promises'
import { Readable } from 'node:stream'

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { AppErrorCode } from '~/common/errors'
import { FileService } from '~/modules/file/file.service'
import { S3Uploader } from '~/utils/s3.util'

vi.mock('~/constants/path.constant', () => {
  return {
    STATIC_FILE_DIR: '/static',
    STATIC_FILE_TRASH_DIR: '/trash',
  }
})

vi.mock('node:fs/promises', () => {
  return {
    access: vi.fn(),
    copyFile: vi.fn(),
    mkdir: vi.fn(),
    readdir: vi.fn(),
    rename: vi.fn(),
    unlink: vi.fn(),
  }
})

vi.mock('~/utils/s3.util', () => {
  const uploadBuffer = vi
    .fn()
    .mockResolvedValue('https://cdn.example.com/f.bin')
  const setCustomDomain = vi.fn()
  return {
    S3Uploader: vi.fn(function (this: Record<string, unknown>) {
      this.uploadBuffer = uploadBuffer
      this.setCustomDomain = setCustomDomain
    }),
  }
})

describe('FileService.deleteFile', () => {
  const createService = () => new FileService({} as any, {} as any)

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should be idempotent when source file is missing (ENOENT)', async () => {
    vi.mocked(mkdir).mockResolvedValue(undefined as any)
    vi.mocked(copyFile).mockRejectedValueOnce(
      Object.assign(new Error('ENOENT'), { code: 'ENOENT' }),
    )

    const service = createService()
    await expect(
      service.deleteFile('image' as any, 'missing.jpg'),
    ).resolves.toBeUndefined()

    expect(mkdir).toHaveBeenCalledWith('/trash', { recursive: true })
    expect(copyFile).toHaveBeenCalledWith(
      '/static/image/missing.jpg',
      '/trash/missing.jpg',
    )
    expect(unlink).not.toHaveBeenCalled()
  })

  it('should copy to trash then unlink source', async () => {
    vi.mocked(mkdir).mockResolvedValue(undefined as any)
    vi.mocked(copyFile).mockResolvedValue(undefined as any)
    vi.mocked(unlink).mockResolvedValue(undefined as any)

    const service = createService()
    await service.deleteFile('image' as any, 'ok.jpg')

    expect(mkdir).toHaveBeenCalledWith('/trash', { recursive: true })
    expect(copyFile).toHaveBeenCalledWith(
      '/static/image/ok.jpg',
      '/trash/ok.jpg',
    )
    expect(unlink).toHaveBeenCalledWith('/static/image/ok.jpg')
  })

  it('should ignore ENOENT from unlink after copy', async () => {
    vi.mocked(mkdir).mockResolvedValue(undefined as any)
    vi.mocked(copyFile).mockResolvedValue(undefined as any)
    vi.mocked(unlink).mockRejectedValueOnce(
      Object.assign(new Error('ENOENT'), { code: 'ENOENT' }),
    )

    const service = createService()
    await expect(
      service.deleteFile('image' as any, 'race.jpg'),
    ).resolves.toBeUndefined()
  })

  it('should reject path traversal names before touching the file system', async () => {
    const service = createService()

    await expect(
      service.deleteFile('image' as any, '../secret.txt'),
    ).rejects.toMatchObject({
      code: AppErrorCode.INVALID_PARAMETER,
    })

    expect(mkdir).not.toHaveBeenCalled()
    expect(copyFile).not.toHaveBeenCalled()
    expect(unlink).not.toHaveBeenCalled()
  })
})

describe('FileService.uploadBuffer', () => {
  const createFileReferenceService = () => ({
    createPendingReference: vi.fn().mockResolvedValue(undefined),
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('tracks owner files written by module-specific producers', async () => {
    const fileReferenceService = createFileReferenceService()
    const service = new FileService({} as any, fileReferenceService as any)
    const stream = Readable.from(Buffer.from('avatar'))
    vi.spyOn(service, 'writeFile').mockResolvedValue(undefined as any)
    vi.spyOn(service, 'resolveFileUrl').mockResolvedValue(
      'http://example.com/objects/avatar/friend.png',
    )

    await expect(
      service.writeTrackedOwnerFile('avatar', 'friend.png', stream),
    ).resolves.toBe('http://example.com/objects/avatar/friend.png')
    expect(service.writeFile).toHaveBeenCalledWith(
      'avatar',
      'friend.png',
      stream,
    )
    expect(fileReferenceService.createPendingReference).toHaveBeenCalledWith(
      'http://example.com/objects/avatar/friend.png',
      'friend.png',
    )
  })

  it('throws when S3 storage is enabled but incomplete', async () => {
    const configService = {
      get: vi.fn(async (key: string) => {
        if (key === 'fileUploadOptions') return { enableCustomNaming: false }
        if (key === 'imageStorageOptions') {
          return {
            enable: true,
            endpoint: '',
            secretId: '',
            secretKey: '',
            bucket: '',
          }
        }
        throw new Error(`Unexpected config key: ${key}`)
      }),
    }
    const fileReferenceService = createFileReferenceService()
    const service = new FileService(
      configService as any,
      fileReferenceService as any,
    )

    await expect(
      service.uploadBuffer(Buffer.from('data'), {
        type: 'image',
        originalFilename: 'a.png',
        contentType: 'image/png',
      }),
    ).rejects.toMatchObject({ code: AppErrorCode.FILE_STORAGE_NOT_CONFIGURED })

    expect(fileReferenceService.createPendingReference).not.toHaveBeenCalled()
  })

  it('uploads to S3 through the prefix template and custom domain, then registers a pending reference with the object key', async () => {
    const configService = {
      get: vi.fn(async (key: string) => {
        if (key === 'fileUploadOptions') {
          return { enableCustomNaming: true, filenameTemplate: '{name}{ext}' }
        }
        if (key === 'imageStorageOptions') {
          return {
            enable: true,
            endpoint: 'https://s3.example.com',
            secretId: 'id',
            secretKey: 'key',
            bucket: 'bucket',
            prefix: 'blog/{type}',
            customDomain: 'https://cdn.example.com',
          }
        }
        throw new Error(`Unexpected config key: ${key}`)
      }),
    }
    const fileReferenceService = createFileReferenceService()
    const service = new FileService(
      configService as any,
      fileReferenceService as any,
    )

    const result = await service.uploadBuffer(Buffer.from('img-bytes'), {
      type: 'image',
      originalFilename: 'origin.png',
      contentType: 'image/png',
    })

    const uploaderInstance = vi.mocked(S3Uploader).mock.instances.at(-1) as any
    expect(uploaderInstance.setCustomDomain).toHaveBeenCalledWith(
      'https://cdn.example.com',
    )
    expect(uploaderInstance.uploadBuffer).toHaveBeenCalledWith(
      expect.any(Buffer),
      'blog/image/origin.png',
      'image/png',
    )
    expect(fileReferenceService.createPendingReference).toHaveBeenCalledWith(
      'https://cdn.example.com/f.bin',
      'origin.png',
      'blog/image/origin.png',
    )
    expect(result).toEqual({
      url: 'https://cdn.example.com/f.bin',
      name: 'origin.png',
      storageBackend: 's3',
      storageKey: 'blog/image/origin.png',
    })
  })

  it('falls back to local storage and registers a pending reference', async () => {
    const configService = {
      get: vi.fn(async (key: string) => {
        if (key === 'fileUploadOptions') {
          return {
            enableCustomNaming: true,
            filenameTemplate: '{name}{ext}',
            pathTemplate: '{type}/nested',
          }
        }
        if (key === 'imageStorageOptions') return { enable: false }
        throw new Error(`Unexpected config key: ${key}`)
      }),
    }
    const fileReferenceService = createFileReferenceService()
    const service = new FileService(
      configService as any,
      fileReferenceService as any,
    )
    const writeFileSpy = vi
      .spyOn(service, 'writeFile')
      .mockResolvedValue(undefined as any)
    const resolveFileUrlSpy = vi
      .spyOn(service, 'resolveFileUrl')
      .mockResolvedValue('http://example.com/objects/image/nested/origin.png')

    const result = await service.uploadBuffer(Buffer.from('img-bytes'), {
      type: 'image',
      originalFilename: 'origin.png',
      contentType: 'image/png',
    })

    expect(writeFileSpy).toHaveBeenCalledWith(
      'image',
      'nested/origin.png',
      expect.any(Readable),
    )
    expect(resolveFileUrlSpy).toHaveBeenCalledWith('image', 'nested/origin.png')
    expect(fileReferenceService.createPendingReference).toHaveBeenCalledWith(
      'http://example.com/objects/image/nested/origin.png',
      'nested/origin.png',
    )
    expect(result).toEqual({
      url: 'http://example.com/objects/image/nested/origin.png',
      name: 'origin.png',
      storageBackend: 'local',
      storageKey: 'nested/origin.png',
    })
  })

  it('registers non-image local uploads for isolated-file tracking', async () => {
    const configService = {
      get: vi.fn(async (key: string) => {
        if (key === 'fileUploadOptions') {
          return { enableCustomNaming: true, filenameTemplate: '{name}{ext}' }
        }
        if (key === 'imageStorageOptions') return { enable: false }
        throw new Error(`Unexpected config key: ${key}`)
      }),
    }
    const fileReferenceService = createFileReferenceService()
    const service = new FileService(
      configService as any,
      fileReferenceService as any,
    )
    vi.spyOn(service, 'writeFile').mockResolvedValue(undefined as any)
    vi.spyOn(service, 'resolveFileUrl').mockResolvedValue(
      'http://example.com/objects/file/abc.bin',
    )

    const result = await service.uploadBuffer(Buffer.from('bytes'), {
      type: 'file',
      originalFilename: 'abc.bin',
      contentType: 'application/octet-stream',
    })

    expect(fileReferenceService.createPendingReference).toHaveBeenCalledWith(
      'http://example.com/objects/file/abc.bin',
      'abc.bin',
    )
    expect(result).toEqual({
      url: 'http://example.com/objects/file/abc.bin',
      name: 'abc.bin',
      storageBackend: 'local',
      storageKey: 'abc.bin',
    })
  })
})
