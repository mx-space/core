import { Readable } from 'node:stream'

import { describe, expect, it, vi } from 'vitest'

import { ErrorCodeEnum } from '~/constants/error-code.constant'
import { FileController } from '~/modules/file/file.controller'

describe('FileController', () => {
  it('falls back to local storage for image uploads when S3 is disabled', async () => {
    const writeFile = vi.fn().mockResolvedValue(undefined)
    const resolveFileUrl = vi
      .fn()
      .mockResolvedValue('http://example.com/objects/image/nested/origin.png')
    const getAndValidMultipartField = vi.fn().mockResolvedValue({
      filename: 'origin.png',
      file: Readable.from(['image-bytes']),
    })
    const createPendingReference = vi.fn().mockResolvedValue(undefined)
    const get = vi.fn().mockImplementation((key: string) => {
      if (key === 'fileUploadOptions') {
        return Promise.resolve({
          enableCustomNaming: true,
          filenameTemplate: '{name}{ext}',
          pathTemplate: '{type}/nested',
        })
      }
      if (key === 'imageStorageOptions') {
        return Promise.resolve({
          enable: false,
        })
      }
      return Promise.reject(new Error(`Unexpected config key: ${key}`))
    })

    const controller = new FileController(
      { writeFile, resolveFileUrl } as any,
      { getAndValidMultipartField } as any,
      { createPendingReference } as any,
      { get } as any,
    )

    const result = await controller.upload({ type: 'image' } as any, {} as any)

    expect(getAndValidMultipartField).toHaveBeenCalledWith(
      {},
      expect.objectContaining({ maxFileSize: 20 * 1024 * 1024 }),
    )
    expect(writeFile).toHaveBeenCalledWith(
      'image',
      'nested/origin.png',
      expect.any(Readable),
    )
    expect(resolveFileUrl).toHaveBeenCalledWith('image', 'nested/origin.png')
    expect(createPendingReference).toHaveBeenCalledWith(
      'http://example.com/objects/image/nested/origin.png',
      'nested/origin.png',
    )
    expect(result).toEqual({
      url: 'http://example.com/objects/image/nested/origin.png',
      name: 'origin.png',
    })
  })

  it('throws when S3 image storage is enabled but incomplete', async () => {
    const writeFile = vi.fn()
    const getAndValidMultipartField = vi.fn()
    const createPendingReference = vi.fn()
    const get = vi.fn().mockImplementation((key: string) => {
      if (key === 'fileUploadOptions') {
        return Promise.resolve({
          enableCustomNaming: false,
        })
      }
      if (key === 'imageStorageOptions') {
        return Promise.resolve({
          enable: true,
          endpoint: '',
          secretId: '',
          secretKey: '',
          bucket: '',
        })
      }
      return Promise.reject(new Error(`Unexpected config key: ${key}`))
    })

    const controller = new FileController(
      { writeFile, resolveFileUrl: vi.fn() } as any,
      { getAndValidMultipartField } as any,
      { createPendingReference } as any,
      { get } as any,
    )

    await expect(
      controller.upload({ type: 'image' } as any, {} as any),
    ).rejects.toMatchObject({
      bizCode: ErrorCodeEnum.ImageStorageNotConfigured,
    })

    expect(getAndValidMultipartField).not.toHaveBeenCalled()
    expect(writeFile).not.toHaveBeenCalled()
    expect(createPendingReference).not.toHaveBeenCalled()
  })
})
