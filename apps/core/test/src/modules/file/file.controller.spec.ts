import { Readable } from 'node:stream'

import { describe, expect, it, vi } from 'vitest'

import { AppException } from '~/common/errors/exception.types'
import { FileController } from '~/modules/file/file.controller'
import { S3Uploader } from '~/utils/s3.util'

vi.mock('~/utils/s3.util', () => {
  const uploadStream = vi
    .fn()
    .mockResolvedValue('https://cdn.example.com/v.mp4')
  const uploadBuffer = vi
    .fn()
    .mockResolvedValue('https://cdn.example.com/f.bin')
  const setCustomDomain = vi.fn()
  return {
    S3Uploader: vi.fn(function (this: Record<string, unknown>) {
      this.uploadStream = uploadStream
      this.uploadBuffer = uploadBuffer
      this.setCustomDomain = setCustomDomain
    }),
  }
})

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
    ).rejects.toThrow(AppException)

    expect(getAndValidMultipartField).not.toHaveBeenCalled()
    expect(writeFile).not.toHaveBeenCalled()
    expect(createPendingReference).not.toHaveBeenCalled()
  })

  it('applies the configured video size limit on local storage', async () => {
    const writeFile = vi.fn().mockResolvedValue(undefined)
    const resolveFileUrl = vi
      .fn()
      .mockResolvedValue('http://example.com/objects/video/clip.mp4')
    const getAndValidMultipartField = vi.fn().mockResolvedValue({
      filename: 'clip.mp4',
      file: Readable.from(['video-bytes']),
    })
    const get = vi.fn().mockImplementation((key: string) => {
      if (key === 'fileUploadOptions') {
        return Promise.resolve({
          enableCustomNaming: true,
          filenameTemplate: '{name}{ext}',
          pathTemplate: '{type}',
          videoMaxSize: 200,
        })
      }
      if (key === 'imageStorageOptions') {
        return Promise.resolve({ enable: false })
      }
      return Promise.reject(new Error(`Unexpected config key: ${key}`))
    })

    const controller = new FileController(
      { writeFile, resolveFileUrl } as any,
      { getAndValidMultipartField } as any,
      { createPendingReference: vi.fn() } as any,
      { get } as any,
    )

    const result = await controller.upload({ type: 'video' } as any, {} as any)

    expect(getAndValidMultipartField).toHaveBeenCalledWith(
      {},
      expect.objectContaining({ maxFileSize: 200 * 1024 * 1024 }),
    )
    expect(writeFile).toHaveBeenCalledWith(
      'video',
      'clip.mp4',
      expect.any(Readable),
    )
    expect(result).toEqual({
      url: 'http://example.com/objects/video/clip.mp4',
      name: 'clip.mp4',
    })
  })

  it('rejects and removes the partial file when a local upload is truncated', async () => {
    const writeFile = vi.fn().mockResolvedValue(undefined)
    const deleteFile = vi.fn().mockResolvedValue(undefined)
    const truncatedStream = Object.assign(Readable.from(['partial']), {
      truncated: true,
    })
    const getAndValidMultipartField = vi.fn().mockResolvedValue({
      filename: 'clip.mp4',
      file: truncatedStream,
    })
    const get = vi.fn().mockImplementation((key: string) => {
      if (key === 'fileUploadOptions') {
        return Promise.resolve({ enableCustomNaming: false })
      }
      if (key === 'imageStorageOptions') {
        return Promise.resolve({ enable: false })
      }
      return Promise.reject(new Error(`Unexpected config key: ${key}`))
    })

    const controller = new FileController(
      { writeFile, deleteFile, resolveFileUrl: vi.fn() } as any,
      { getAndValidMultipartField } as any,
      { createPendingReference: vi.fn() } as any,
      { get } as any,
    )

    await expect(
      controller.upload({ type: 'video' } as any, {} as any),
    ).rejects.toThrow(AppException)
    expect(deleteFile).toHaveBeenCalled()
  })

  it('streams video uploads to S3 without a size limit when S3 is enabled', async () => {
    const getAndValidMultipartField = vi.fn().mockResolvedValue({
      filename: 'clip.mp4',
      file: Readable.from(['video-bytes']),
    })
    const createPendingReference = vi.fn().mockResolvedValue(undefined)
    const get = vi.fn().mockImplementation((key: string) => {
      if (key === 'fileUploadOptions') {
        return Promise.resolve({ enableCustomNaming: false })
      }
      if (key === 'imageStorageOptions') {
        return Promise.resolve({
          enable: true,
          endpoint: 'https://s3.example.com',
          secretId: 'id',
          secretKey: 'key',
          bucket: 'bucket',
        })
      }
      return Promise.reject(new Error(`Unexpected config key: ${key}`))
    })

    const controller = new FileController(
      { writeFile: vi.fn(), resolveFileUrl: vi.fn() } as any,
      { getAndValidMultipartField } as any,
      { createPendingReference } as any,
      { get } as any,
    )

    const result = await controller.upload({ type: 'video' } as any, {} as any)

    expect(getAndValidMultipartField).toHaveBeenCalledWith(
      {},
      expect.objectContaining({ maxFileSize: Number.MAX_SAFE_INTEGER }),
    )
    const uploaderInstance = vi.mocked(S3Uploader).mock.instances.at(-1) as any
    expect(uploaderInstance.uploadStream).toHaveBeenCalledWith(
      expect.any(Readable),
      expect.stringContaining('.mp4'),
      'video/mp4',
    )
    expect(uploaderInstance.uploadBuffer).not.toHaveBeenCalled()
    expect(result).toEqual({
      url: 'https://cdn.example.com/v.mp4',
      name: expect.stringContaining('.mp4'),
    })
  })
})
