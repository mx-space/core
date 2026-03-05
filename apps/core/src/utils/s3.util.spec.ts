import * as crypto from 'node:crypto'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { S3EndpointStrategy, S3UploaderOptions } from './s3.util'
import { DefaultS3Strategy, S3Uploader, TencentCosStrategy } from './s3.util'

// Mock fetch
global.fetch = vi.fn()

describe('S3Uploader', () => {
  let uploader: S3Uploader
  let options: S3UploaderOptions
  let mockBuffer: Buffer

  beforeEach(() => {
    // Setup test data
    options = {
      bucket: 'test-bucket',
      region: 'us-east-1',
      accessKey: 'test-access-key',
      secretKey: 'test-secret-key',
      endpoint: 'https://test-endpoint.com',
    }
    uploader = new S3Uploader(options)
    mockBuffer = Buffer.from('test-file-content')

    // Reset and setup fetch mock
    vi.mocked(fetch).mockReset()
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
    } as Response)
  })

  describe('constructor and getters', () => {
    it('should initialize with provided options', () => {
      expect(uploader.bucket).toBe(options.bucket)
      expect(uploader.region).toBe(options.region)
      expect(uploader.accessKey).toBe(options.accessKey)
      expect(uploader.secretKey).toBe(options.secretKey)
      expect(uploader.endpoint).toBe(options.endpoint)
    })

    it('should generate endpoint when not provided', () => {
      const noEndpointOptions = { ...options, endpoint: undefined }
      const noEndpointUploader = new S3Uploader(noEndpointOptions)
      expect(noEndpointUploader.endpoint).toBe(
        `https://${options.bucket}.s3.${options.region}.amazonaws.com`,
      )
    })
  })

  describe('setters', () => {
    it('should update options', () => {
      const newOptions: S3UploaderOptions = {
        bucket: 'new-bucket',
        region: 'eu-west-1',
        accessKey: 'new-access-key',
        secretKey: 'new-secret-key',
      }
      uploader.setOptions(newOptions)
      expect(uploader.bucket).toBe(newOptions.bucket)
      expect(uploader.region).toBe(newOptions.region)
      expect(uploader.accessKey).toBe(newOptions.accessKey)
      expect(uploader.secretKey).toBe(newOptions.secretKey)
    })

    it('should update custom domain', () => {
      const domain = 'https://cdn.example.com'
      uploader.setCustomDomain(domain)
      vi.spyOn(crypto, 'createHash').mockImplementation(() => {
        return {
          update: () => ({
            digest: () => 'mock-hash',
          }),
        } as any
      })
      return uploader.uploadImage(mockBuffer, 'images').then((url) => {
        expect(url).toBe(`${domain}/images/mock-hash.png`)
      })
    })
  })

  describe('uploadImage', () => {
    it('should upload image and return URL', async () => {
      // Mock the crypto hash function
      vi.spyOn(crypto, 'createHash').mockImplementation(() => {
        return {
          update: () => ({
            digest: () => 'mock-hash',
          }),
        } as any
      })

      const result = await uploader.uploadImage(mockBuffer, 'images')
      expect(result).toBe('images/images/mock-hash.png')
      expect(fetch).toHaveBeenCalledTimes(1)
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/test-bucket/images/mock-hash.png'),
        expect.objectContaining({
          method: 'PUT',
          headers: expect.objectContaining({
            'Content-Type': 'image/png',
          }),
          body: mockBuffer,
        }),
      )
    })
  })

  describe('uploadFile', () => {
    it('should upload a file and return URL', async () => {
      // Mock the crypto hash function
      vi.spyOn(crypto, 'createHash').mockImplementation(() => {
        return {
          update: () => ({
            digest: () => 'mock-hash',
          }),
        } as any
      })

      const result = await uploader.uploadFile(mockBuffer, 'files/document.pdf')
      expect(result).toBe('files/document.pdf/files/document.pdf/mock-hash.pdf')
      expect(fetch).toHaveBeenCalledTimes(1)
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining(
          '/test-bucket/files/document.pdf/mock-hash.pdf',
        ),
        expect.objectContaining({
          method: 'PUT',
          headers: expect.objectContaining({
            'Content-Type': 'application/octet-stream',
          }),
          body: mockBuffer,
        }),
      )
    })
  })

  describe('uploadToS3', () => {
    it('should throw error when upload fails', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 403,
      } as Response)

      await expect(
        uploader.uploadToS3('test-object', mockBuffer, 'text/plain'),
      ).rejects.toThrow('Upload failed with status code: 403')
    })

    it('should successfully upload to S3', async () => {
      await uploader.uploadToS3('test-object', mockBuffer, 'text/plain')
      expect(fetch).toHaveBeenCalledTimes(1)
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/test-bucket/test-object'),
        expect.objectContaining({
          method: 'PUT',
          body: mockBuffer,
        }),
      )
    })
  })

  describe('endpoint strategies', () => {
    afterEach(() => {
      S3Uploader.resetStrategies()
    })

    describe('TencentCosStrategy', () => {
      const strategy = new TencentCosStrategy()

      it('should match myqcloud.com hosts', () => {
        expect(strategy.matches('cos.ap-guangzhou.myqcloud.com')).toBe(true)
      })

      it('should match hosts containing .cos.', () => {
        expect(strategy.matches('bucket.cos.ap-guangzhou.myqcloud.com')).toBe(
          true,
        )
      })

      it('should not match unrelated hosts', () => {
        expect(strategy.matches('s3.amazonaws.com')).toBe(false)
      })

      it('should resolve virtual-hosted style for cos.* hosts', () => {
        const result = strategy.resolve({
          host: 'cos.ap-guangzhou.myqcloud.com',
          bucket: 'my-bucket',
          encodedObjectKey: 'path/to/file.png',
          protocol: 'https:',
        })
        expect(result.requestHost).toBe(
          'my-bucket.cos.ap-guangzhou.myqcloud.com',
        )
        expect(result.canonicalUri).toBe('/path/to/file.png')
        expect(result.baseUrl).toBe(
          'https://my-bucket.cos.ap-guangzhou.myqcloud.com',
        )
      })
    })

    describe('DefaultS3Strategy', () => {
      const strategy = new DefaultS3Strategy()

      it('should match any host', () => {
        expect(strategy.matches('anything.example.com')).toBe(true)
      })

      it('should use path style when host does not start with bucket', () => {
        const result = strategy.resolve({
          host: 's3.us-east-1.amazonaws.com',
          bucket: 'my-bucket',
          encodedObjectKey: 'file.txt',
          protocol: 'https:',
        })
        expect(result.canonicalUri).toBe('/my-bucket/file.txt')
        expect(result.requestHost).toBe('s3.us-east-1.amazonaws.com')
      })

      it('should use virtual-hosted style when host starts with bucket', () => {
        const result = strategy.resolve({
          host: 'my-bucket.s3.us-east-1.amazonaws.com',
          bucket: 'my-bucket',
          encodedObjectKey: 'file.txt',
          protocol: 'https:',
        })
        expect(result.canonicalUri).toBe('/file.txt')
      })
    })

    describe('custom strategy registration', () => {
      it('should use a registered custom strategy when it matches', async () => {
        const customStrategy: S3EndpointStrategy = {
          name: 'CustomProvider',
          matches: (host) => host.includes('custom-storage.example.com'),
          resolve: (ctx) => ({
            requestHost: `${ctx.bucket}.custom-storage.example.com`,
            canonicalUri: `/${ctx.encodedObjectKey}`,
            baseUrl: `${ctx.protocol}//${ctx.bucket}.custom-storage.example.com`,
          }),
        }

        S3Uploader.registerStrategy(customStrategy)

        const customUploader = new S3Uploader({
          bucket: 'test-bucket',
          region: 'us-east-1',
          accessKey: 'key',
          secretKey: 'secret',
          endpoint: 'https://custom-storage.example.com',
        })

        await customUploader.uploadToS3('obj', mockBuffer, 'text/plain')

        expect(fetch).toHaveBeenCalledWith(
          'https://test-bucket.custom-storage.example.com/obj',
          expect.objectContaining({ method: 'PUT' }),
        )
      })

      it('should fall back to default strategy when no custom matches', async () => {
        const neverMatchStrategy: S3EndpointStrategy = {
          name: 'NeverMatch',
          matches: () => false,
          resolve: () => {
            throw new Error('Should not be called')
          },
        }

        S3Uploader.registerStrategy(neverMatchStrategy)

        await uploader.uploadToS3('obj', mockBuffer, 'text/plain')

        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining('/test-bucket/obj'),
          expect.objectContaining({ method: 'PUT' }),
        )
      })
    })
  })
})
