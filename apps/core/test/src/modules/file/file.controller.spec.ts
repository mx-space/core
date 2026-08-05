import { Readable } from 'node:stream'

import { describe, expect, it, vi } from 'vitest'

import { AppErrorCode, createAppException } from '~/common/errors'
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
  it('serves a file whose name contains nested comment-upload directories', async () => {
    const stream = Readable.from(['image-bytes'])
    const getFileStream = vi.fn().mockResolvedValue(stream)
    const reply = {
      type: vi.fn().mockReturnThis(),
      header: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
    }
    const controller = new FileController(
      { getFileStream } as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    )

    await controller.get(
      'image',
      {
        params: {
          '*': 'comments/reader-id/2026/08/comment-image.jpg',
        },
      } as any,
      reply as any,
    )

    expect(getFileStream).toHaveBeenCalledWith(
      'image',
      'comments/reader-id/2026/08/comment-image.jpg',
    )
    expect(reply.type).toHaveBeenCalledWith('image/jpeg')
    expect(reply.send).toHaveBeenCalledWith(stream)
  })

  it('buffers image uploads and delegates storage to service.uploadBuffer', async () => {
    const uploadBuffer = vi.fn().mockResolvedValue({
      url: 'http://example.com/objects/image/nested/origin.png',
      name: 'origin.png',
    })
    const getAndValidMultipartField = vi.fn().mockResolvedValue({
      filename: 'origin.png',
      file: Readable.from([Buffer.from('image-bytes')]),
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
      { uploadBuffer } as any,
      { getAndValidMultipartField } as any,
      { createPendingReference: vi.fn() } as any,
      {} as any,
      { get } as any,
    )

    const result = await controller.upload({ type: 'image' } as any, {} as any)

    expect(getAndValidMultipartField).toHaveBeenCalledWith(
      {},
      expect.objectContaining({ maxFileSize: 20 * 1024 * 1024 }),
    )
    expect(uploadBuffer).toHaveBeenCalledWith(expect.any(Buffer), {
      type: 'image',
      originalFilename: 'origin.png',
      contentType: 'image/png',
    })
    expect(uploadBuffer.mock.calls[0][0].toString()).toBe('image-bytes')
    expect(result).toEqual({
      url: 'http://example.com/objects/image/nested/origin.png',
      name: 'origin.png',
    })
  })

  it('propagates the storage-not-configured error thrown by service.uploadBuffer', async () => {
    const uploadBuffer = vi
      .fn()
      .mockRejectedValue(
        createAppException(AppErrorCode.FILE_STORAGE_NOT_CONFIGURED),
      )
    const getAndValidMultipartField = vi.fn().mockResolvedValue({
      filename: 'origin.png',
      file: Readable.from([Buffer.from('image-bytes')]),
    })
    const get = vi.fn().mockImplementation((key: string) => {
      if (key === 'fileUploadOptions') {
        return Promise.resolve({ enableCustomNaming: false })
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
      { uploadBuffer } as any,
      { getAndValidMultipartField } as any,
      { createPendingReference: vi.fn() } as any,
      {} as any,
      { get } as any,
    )

    await expect(
      controller.upload({ type: 'image' } as any, {} as any),
    ).rejects.toThrow(AppException)

    expect(getAndValidMultipartField).toHaveBeenCalled()
    expect(uploadBuffer).toHaveBeenCalled()
  })

  it('rejects a truncated local upload without calling service.uploadBuffer', async () => {
    const uploadBuffer = vi.fn()
    const truncatedStream = Object.assign(
      Readable.from([Buffer.from('partial')]),
      { truncated: true },
    )
    const getAndValidMultipartField = vi.fn().mockResolvedValue({
      filename: 'doc.pdf',
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
      { uploadBuffer } as any,
      { getAndValidMultipartField } as any,
      { createPendingReference: vi.fn() } as any,
      {} as any,
      { get } as any,
    )

    await expect(
      controller.upload({ type: 'file' } as any, {} as any),
    ).rejects.toThrow(AppException)

    expect(uploadBuffer).not.toHaveBeenCalled()
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
      {} as any,
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
      {} as any,
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
      {} as any,
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

  it('delegates dry-run and apply reference reconciliation requests', async () => {
    const reconcile = vi.fn().mockResolvedValue({ applied: false })
    const controller = new FileController(
      {} as any,
      {} as any,
      {} as any,
      { reconcile } as any,
      {} as any,
    )

    await expect(
      controller.reconcileFileReferences({ apply: false }),
    ).resolves.toEqual({ applied: false })
    expect(reconcile).toHaveBeenCalledWith({ apply: false })
  })
})
