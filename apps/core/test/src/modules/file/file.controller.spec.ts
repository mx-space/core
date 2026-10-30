import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { Readable } from 'node:stream'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

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
  const objectExists = vi.fn().mockResolvedValue(false)
  return {
    S3Uploader: vi.fn(function (this: Record<string, unknown>) {
      this.uploadStream = uploadStream
      this.uploadBuffer = uploadBuffer
      this.setCustomDomain = setCustomDomain
      this.objectExists = objectExists
    }),
  }
})

const passthroughMedia = {
  isVideoTranscodeEnabled: async () => false,
  processImage: async () => null,
  transcodeVideo: async () => null,
}

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
      passthroughMedia as any,
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
      passthroughMedia as any,
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

  it('allocates separate version keys even with a fixed naming template', async () => {
    const stored = new Map<string, string>()
    const uploadBuffer = vi.fn(
      async (buffer: Buffer, options: { objectKey: string }) => {
        stored.set(options.objectKey, buffer.toString())
        return { url: `https://files.example/${options.objectKey}` }
      },
    )
    const getAndValidMultipartField = vi
      .fn()
      .mockResolvedValueOnce({
        filename: 'widget.js',
        file: Readable.from([Buffer.from('version one')]),
      })
      .mockResolvedValueOnce({
        filename: 'widget.js',
        file: Readable.from([Buffer.from('version two')]),
      })
    const controller = new FileController(
      { uploadBuffer } as any,
      { getAndValidMultipartField } as any,
      {} as any,
      {} as any,
      {
        get: async (key: string) =>
          key === 'fileUploadOptions'
            ? { enableCustomNaming: true, filenameTemplate: 'fixed.js' }
            : { enable: false },
      } as any,
      passthroughMedia as any,
    )
    const first = await controller.upload(
      { type: 'file', immutable: 'true' },
      {} as any,
    )
    const second = await controller.upload(
      { type: 'file', immutable: 'true' },
      {} as any,
    )
    expect(first.url).not.toBe(second.url)
    expect([...stored.values()]).toEqual(['version one', 'version two'])
    expect(
      [...stored.keys()].every(
        (key) => key.startsWith('versions/') && key.endsWith('.js'),
      ),
    ).toBe(true)
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
      passthroughMedia as any,
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
      passthroughMedia as any,
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
      {
        writeFile,
        resolveFileUrl,
        resolveUniqueLocalName: vi.fn(
          async (_type: string, name: string) => name,
        ),
      } as any,
      { getAndValidMultipartField } as any,
      { createPendingReference: vi.fn() } as any,
      {} as any,
      { get } as any,
      passthroughMedia as any,
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
      {
        writeFile,
        deleteFile,
        resolveFileUrl: vi.fn(),
        resolveUniqueLocalName: vi.fn(
          async (_type: string, name: string) => name,
        ),
      } as any,
      { getAndValidMultipartField } as any,
      { createPendingReference: vi.fn() } as any,
      {} as any,
      { get } as any,
      passthroughMedia as any,
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
      passthroughMedia as any,
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

  it('streams a video to a fresh S3 key when the templated key is taken', async () => {
    vi.mocked(S3Uploader).mockImplementationOnce(function (this: any) {
      this.uploadStream = vi.fn().mockResolvedValue('https://s3/v.mp4')
      this.setCustomDomain = vi.fn()
      this.objectExists = vi.fn(async (key: string) => key === 'clip.mp4')
    } as any)
    const get = vi.fn().mockImplementation((key: string) => {
      if (key === 'fileUploadOptions') {
        return Promise.resolve({
          enableCustomNaming: true,
          filenameTemplate: '{name}{ext}',
        })
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
      {} as any,
      {
        getAndValidMultipartField: vi.fn().mockResolvedValue({
          filename: 'clip.mp4',
          file: Readable.from(['video-bytes']),
        }),
      } as any,
      { createPendingReference: vi.fn() } as any,
      {} as any,
      { get } as any,
      passthroughMedia as any,
    )

    const result = await controller.upload({ type: 'video' } as any, {} as any)

    const uploader = vi.mocked(S3Uploader).mock.instances.at(-1) as any
    const key = uploader.uploadStream.mock.calls[0][1] as string
    expect(key).toMatch(/^clip-[\da-z]{6}\.mp4$/)
    expect(result.name).toBe(key)
  })

  it('writes a local video under a free name when the templated name is taken', async () => {
    const writeFile = vi.fn().mockResolvedValue(undefined)
    const resolveUniqueLocalName = vi.fn().mockResolvedValue('clip-abc123.mp4')
    const get = vi.fn().mockImplementation((key: string) => {
      if (key === 'fileUploadOptions') {
        return Promise.resolve({
          enableCustomNaming: true,
          filenameTemplate: '{name}{ext}',
          pathTemplate: '{type}',
        })
      }
      if (key === 'imageStorageOptions')
        return Promise.resolve({ enable: false })
      return Promise.reject(new Error(`Unexpected config key: ${key}`))
    })
    const controller = new FileController(
      {
        resolveFileUrl: vi.fn().mockResolvedValue('http://x/clip-abc123.mp4'),
        resolveUniqueLocalName,
        writeFile,
      } as any,
      {
        getAndValidMultipartField: vi.fn().mockResolvedValue({
          filename: 'clip.mp4',
          file: Readable.from(['video-bytes']),
        }),
      } as any,
      { createPendingReference: vi.fn() } as any,
      {} as any,
      { get } as any,
      passthroughMedia as any,
    )

    await controller.upload({ type: 'video' } as any, {} as any)

    expect(resolveUniqueLocalName).toHaveBeenCalledWith('video', 'clip.mp4')
    expect(writeFile).toHaveBeenCalledWith(
      'video',
      'clip-abc123.mp4',
      expect.any(Readable),
    )
  })

  describe('media post-processing', () => {
    const localConfig = (key: string) => {
      if (key === 'fileUploadOptions') {
        return Promise.resolve({
          enableCustomNaming: true,
          filenameTemplate: '{name}{ext}',
          pathTemplate: '{type}',
          videoMaxSize: 50,
        })
      }
      if (key === 'imageStorageOptions') {
        return Promise.resolve({ enable: false })
      }
      return Promise.reject(new Error(`Unexpected config key: ${key}`))
    }
    const s3Config = (key: string) => {
      if (key === 'fileUploadOptions') {
        return Promise.resolve({
          enableCustomNaming: true,
          filenameTemplate: '{name}{ext}',
          videoMaxSize: 50,
        })
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
    }

    let workDir: string
    let transcodedPath: string
    beforeEach(async () => {
      workDir = await mkdtemp(path.join(tmpdir(), 'byline-controller-'))
      transcodedPath = path.join(workDir, 'output.webm')
      await writeFile(transcodedPath, 'webm-bytes')
    })
    afterEach(async () => {
      await rm(workDir, { recursive: true, force: true })
    })

    const transcodingMedia = (
      cleanup = vi.fn().mockResolvedValue(undefined),
    ) => ({
      isVideoTranscodeEnabled: vi.fn().mockResolvedValue(true),
      processImage: vi.fn().mockResolvedValue(null),
      transcodeVideo: vi.fn().mockResolvedValue({
        path: transcodedPath,
        filename: 'clip.webm',
        contentType: 'video/webm',
        cleanup,
      }),
    })

    it('stores the WebP output in place of the uploaded image', async () => {
      const uploadBuffer = vi.fn().mockResolvedValue({ url: 'u', name: 'n' })
      const processImage = vi.fn().mockResolvedValue({
        buffer: Buffer.from('webp-bytes'),
        filename: 'origin.webp',
        contentType: 'image/webp',
      })
      const controller = new FileController(
        { uploadBuffer } as any,
        {
          getAndValidMultipartField: vi.fn().mockResolvedValue({
            filename: 'origin.png',
            file: Readable.from([Buffer.from('png-bytes')]),
          }),
        } as any,
        {} as any,
        {} as any,
        { get: localConfig } as any,
        { ...passthroughMedia, processImage } as any,
      )

      await controller.upload({ type: 'image' } as any, {} as any)

      expect(processImage.mock.calls[0][0].toString()).toBe('png-bytes')
      expect(processImage).toHaveBeenCalledWith(
        expect.any(Buffer),
        'origin.png',
      )
      expect(uploadBuffer).toHaveBeenCalledWith(expect.any(Buffer), {
        type: 'image',
        originalFilename: 'origin.webp',
        contentType: 'image/webp',
      })
      expect(uploadBuffer.mock.calls[0][0].toString()).toBe('webp-bytes')
    })

    it('gives an immutable WebP version key the .webp extension', async () => {
      const uploadBuffer = vi.fn().mockResolvedValue({ url: 'u', name: 'n' })
      const controller = new FileController(
        { uploadBuffer } as any,
        {
          getAndValidMultipartField: vi.fn().mockResolvedValue({
            filename: 'origin.png',
            file: Readable.from([Buffer.from('png-bytes')]),
          }),
        } as any,
        {} as any,
        {} as any,
        { get: localConfig } as any,
        {
          ...passthroughMedia,
          processImage: vi.fn().mockResolvedValue({
            buffer: Buffer.from('webp-bytes'),
            filename: 'origin.webp',
            contentType: 'image/webp',
          }),
        } as any,
      )

      await controller.upload(
        { type: 'image', immutable: 'true' } as any,
        {} as any,
      )

      expect(uploadBuffer.mock.calls[0][1].objectKey).toMatch(
        /^versions\/[\da-f-]+\.webp$/,
      )
    })

    it('does not post-process non-image file uploads', async () => {
      const processImage = vi.fn()
      const controller = new FileController(
        { uploadBuffer: vi.fn().mockResolvedValue({}) } as any,
        {
          getAndValidMultipartField: vi.fn().mockResolvedValue({
            filename: 'photo.png',
            file: Readable.from([Buffer.from('png-bytes')]),
          }),
        } as any,
        {} as any,
        {} as any,
        { get: localConfig } as any,
        { ...passthroughMedia, processImage } as any,
      )

      await controller.upload({ type: 'file' } as any, {} as any)

      expect(processImage).not.toHaveBeenCalled()
    })

    it('stores the original image for a raw upload', async () => {
      const uploadBuffer = vi.fn().mockResolvedValue({ url: 'u', name: 'n' })
      const processImage = vi.fn()
      const controller = new FileController(
        { uploadBuffer } as any,
        {
          getAndValidMultipartField: vi.fn().mockResolvedValue({
            filename: 'origin.jpg',
            file: Readable.from([Buffer.from('jpg-bytes')]),
          }),
        } as any,
        {} as any,
        {} as any,
        { get: localConfig } as any,
        { ...passthroughMedia, processImage } as any,
      )

      await controller.upload({ type: 'image', raw: 'true' } as any, {} as any)

      expect(processImage).not.toHaveBeenCalled()
      expect(uploadBuffer).toHaveBeenCalledWith(expect.any(Buffer), {
        type: 'image',
        originalFilename: 'origin.jpg',
        contentType: 'image/jpeg',
      })
      expect(uploadBuffer.mock.calls[0][0].toString()).toBe('jpg-bytes')
    })

    it('streams the original video to S3 without a size cap for a raw upload', async () => {
      const media = transcodingMedia()
      const source = Readable.from(['mp4-bytes'])
      const getAndValidMultipartField = vi.fn().mockResolvedValue({
        filename: 'clip.mp4',
        file: source,
      })
      const controller = new FileController(
        {} as any,
        { getAndValidMultipartField } as any,
        { createPendingReference: vi.fn() } as any,
        {} as any,
        { get: s3Config } as any,
        media as any,
      )

      const result = await controller.upload(
        { type: 'video', raw: 'true' } as any,
        {} as any,
      )

      expect(media.transcodeVideo).not.toHaveBeenCalled()
      expect(getAndValidMultipartField).toHaveBeenCalledWith(
        {},
        expect.objectContaining({ maxFileSize: Number.MAX_SAFE_INTEGER }),
      )
      const uploader = vi.mocked(S3Uploader).mock.instances.at(-1) as any
      const [stream, key, contentType] = uploader.uploadStream.mock.calls.at(-1)
      expect(stream).toBe(source)
      expect(key).toBe('clip.mp4')
      expect(contentType).toBe('video/mp4')
      expect(result.name).toBe('clip.mp4')
    })

    it('writes the transcoded WebM to local storage and cleans up', async () => {
      const cleanup = vi.fn().mockResolvedValue(undefined)
      const media = transcodingMedia(cleanup)
      const written: string[] = []
      const writeFileMock = vi.fn(
        async (_type: string, name: string, stream: Readable) => {
          for await (const chunk of stream) written.push(chunk.toString())
          written.unshift(name)
        },
      )
      const getAndValidMultipartField = vi.fn().mockResolvedValue({
        filename: 'clip.mp4',
        file: Readable.from(['mp4-bytes']),
      })
      const controller = new FileController(
        {
          writeFile: writeFileMock,
          resolveFileUrl: vi.fn(
            async (_type: string, name: string) => `http://x/${name}`,
          ),
          resolveUniqueLocalName: vi.fn(
            async (_type: string, name: string) => name,
          ),
        } as any,
        { getAndValidMultipartField } as any,
        { createPendingReference: vi.fn() } as any,
        {} as any,
        { get: localConfig } as any,
        media as any,
      )

      const result = await controller.upload(
        { type: 'video' } as any,
        {} as any,
      )

      expect(media.transcodeVideo).toHaveBeenCalledWith(
        expect.any(Readable),
        'clip.mp4',
      )
      expect(written).toEqual(['clip.webm', 'webm-bytes'])
      expect(result).toEqual({ url: 'http://x/clip.webm', name: 'clip.webm' })
      expect(cleanup).toHaveBeenCalled()
    })

    it('caps S3 video uploads by the size limit and stores the WebM', async () => {
      const cleanup = vi.fn().mockResolvedValue(undefined)
      const media = transcodingMedia(cleanup)
      const getAndValidMultipartField = vi.fn().mockResolvedValue({
        filename: 'clip.mp4',
        file: Readable.from(['mp4-bytes']),
      })
      const controller = new FileController(
        {} as any,
        { getAndValidMultipartField } as any,
        { createPendingReference: vi.fn() } as any,
        {} as any,
        { get: s3Config } as any,
        media as any,
      )

      const result = await controller.upload(
        { type: 'video' } as any,
        {} as any,
      )

      expect(getAndValidMultipartField).toHaveBeenCalledWith(
        {},
        expect.objectContaining({ maxFileSize: 50 * 1024 * 1024 }),
      )
      const uploader = vi.mocked(S3Uploader).mock.instances.at(-1) as any
      const [stream, key, contentType] = uploader.uploadStream.mock.calls.at(-1)
      expect(key).toBe('clip.webm')
      expect(contentType).toBe('video/webm')
      expect(stream).not.toBe(getAndValidMultipartField.mock.results[0])
      expect(result.name).toBe('clip.webm')
      expect(cleanup).toHaveBeenCalled()
    })

    it('cleans up the transcode output when storing it fails', async () => {
      const cleanup = vi.fn().mockResolvedValue(undefined)
      const controller = new FileController(
        {
          writeFile: vi.fn().mockRejectedValue(new Error('disk full')),
          resolveUniqueLocalName: vi.fn(
            async (_type: string, name: string) => name,
          ),
        } as any,
        {
          getAndValidMultipartField: vi.fn().mockResolvedValue({
            filename: 'clip.mp4',
            file: Readable.from(['mp4-bytes']),
          }),
        } as any,
        {} as any,
        {} as any,
        { get: localConfig } as any,
        transcodingMedia(cleanup) as any,
      )

      await expect(
        controller.upload({ type: 'video' } as any, {} as any),
      ).rejects.toThrow('disk full')
      expect(cleanup).toHaveBeenCalled()
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
      passthroughMedia as any,
    )

    await expect(
      controller.reconcileFileReferences({ apply: false }),
    ).resolves.toEqual({ applied: false })
    expect(reconcile).toHaveBeenCalledWith({ apply: false })
  })
})
