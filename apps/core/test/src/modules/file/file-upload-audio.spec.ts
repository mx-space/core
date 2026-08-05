import { access } from 'node:fs/promises'
import { Readable } from 'node:stream'

import { describe, expect, it, vi } from 'vitest'

import { FileService } from '~/modules/file/file.service'
import { S3Uploader } from '~/utils/s3.util'

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

describe('FileService.uploadBuffer audio', () => {
  it('uses the explicit objectKey instead of the filename template', async () => {
    const { service } = createService({ s3Enabled: false })
    const result = await service.uploadBuffer(Buffer.from('x'), {
      type: 'audio',
      contentType: 'audio/mpeg',
      objectKey: 'tts/1/zh/blk-0-abcdef123456.mp3',
      skipReference: true,
    })

    expect(result.storageBackend).toBe('local')
    expect(result.storageKey).toBe('tts/1/zh/blk-0-abcdef123456.mp3')
    expect(result.url).toBe(
      'https://example.com/objects/audio/tts/1/zh/blk-0-abcdef123456.mp3',
    )
  })

  it('creates no file reference when skipReference is set', async () => {
    const { service, fileReferenceService } = createService({
      s3Enabled: false,
    })
    await service.uploadBuffer(Buffer.from('x'), {
      type: 'audio',
      contentType: 'audio/mpeg',
      objectKey: 'tts/1/zh/blk-0-abcdef123456.mp3',
      skipReference: true,
    })

    expect(fileReferenceService.createPendingReference).not.toHaveBeenCalled()
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
        skipReference: true,
      })

    await upload()

    await expect(upload()).rejects.toMatchObject({ code: 'FILE_EXISTS' })

    await service.deleteObject('local', objectKey)
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
})

describe('FileService.listObjectsUnderPrefix', () => {
  it('walks the local directory and reports each file with its mtime', async () => {
    const { service } = createService({ s3Enabled: false })
    vi.mocked(service.writeFile).mockRestore()
    const runId = `walk-${Date.now()}`
    const keyA = `tts/${runId}/zh/a.mp3`
    const keyB = `tts/${runId}/en/b.mp3`
    await service.writeFile('audio', keyA, Readable.from(Buffer.from('x')))
    await service.writeFile('audio', keyB, Readable.from(Buffer.from('y')))

    const objects = await service.listObjectsUnderPrefix('audio', 'tts/')

    const found = objects.filter((o) => o.storageKey.includes(runId))
    expect(found).toHaveLength(2)
    for (const object of found) {
      expect(object.storageBackend).toBe('local')
      expect(object.lastModified).toBeInstanceOf(Date)
    }
    expect(found.map((o) => o.storageKey).sort()).toEqual([keyA, keyB].sort())

    await service.deleteObject('local', keyA)
    await service.deleteObject('local', keyB)
  })

  it('returns an empty array when the local directory does not exist', async () => {
    const { service } = createService({ s3Enabled: false })

    const objects = await service.listObjectsUnderPrefix(
      'audio',
      `tts-missing-${Date.now()}/`,
    )

    expect(objects).toEqual([])
  })

  it('is a no-op when S3 is enabled but not fully configured', async () => {
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
      service.listObjectsUnderPrefix('audio', 'tts/'),
    ).resolves.toBeNull()
  })

  it('delegates to S3Uploader.listObjects with the configured prefix', async () => {
    const { service } = createService({ s3Enabled: true, prefix: 'blog' })
    const listObjectsSpy = vi
      .spyOn(S3Uploader.prototype, 'listObjects')
      .mockResolvedValue([
        { key: 'blog/tts/1/zh/a.mp3', lastModified: new Date('2026-01-01') },
      ])

    const objects = await service.listObjectsUnderPrefix('audio', 'tts/')

    expect(listObjectsSpy).toHaveBeenCalledWith('blog/tts/')
    expect(objects).toEqual([
      {
        storageBackend: 's3',
        storageKey: 'blog/tts/1/zh/a.mp3',
        lastModified: new Date('2026-01-01'),
      },
    ])
    listObjectsSpy.mockRestore()
  })
})
