import { access } from 'node:fs/promises'
import { Readable } from 'node:stream'

import { describe, expect, it, vi } from 'vitest'

import { FileService } from '~/modules/file/file.service'

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
