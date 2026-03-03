import * as crypto from 'node:crypto'
import type { S3EndpointContext, S3UploaderOptions } from '~/utils/s3.util'
import {
  DefaultS3EndpointStrategy,
  S3Uploader,
  TencentCosEndpointStrategy,
} from '~/utils/s3.util'
import { beforeEach, describe, expect, it, vi } from 'vitest'

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

  describe('TencentCosEndpointStrategy', () => {
    const strategy = new TencentCosEndpointStrategy()

    it('should match myqcloud.com hosts', () => {
      expect(strategy.matches('cos.ap-guangzhou.myqcloud.com', 'bucket')).toBe(
        true,
      )
    })

    it('should match hosts containing .cos.', () => {
      expect(
        strategy.matches('bucket.cos.ap-guangzhou.myqcloud.com', 'bucket'),
      ).toBe(true)
    })

    it('should not match generic S3 hosts', () => {
      expect(strategy.matches('s3.amazonaws.com', 'bucket')).toBe(false)
      expect(strategy.matches('test-endpoint.com', 'bucket')).toBe(false)
    })

    it('should convert cos.region.myqcloud.com to virtual-hosted style', () => {
      const context: S3EndpointContext = {
        protocol: 'https:',
        host: 'cos.ap-guangzhou.myqcloud.com',
        bucket: 'my-bucket',
        endpoint: 'https://cos.ap-guangzhou.myqcloud.com',
        encodedObjectKey: 'folder/file.png',
      }
      const result = strategy.resolve(context)
      expect(result.requestHost).toBe('my-bucket.cos.ap-guangzhou.myqcloud.com')
      expect(result.canonicalUri).toBe('/folder/file.png')
      expect(result.baseUrl).toBe(
        'https://my-bucket.cos.ap-guangzhou.myqcloud.com',
      )
    })

    it('should keep existing requestHost when host does not match cos.* pattern', () => {
      const context: S3EndpointContext = {
        protocol: 'https:',
        host: 'my-bucket.cos.ap-guangzhou.myqcloud.com',
        bucket: 'my-bucket',
        endpoint: 'https://my-bucket.cos.ap-guangzhou.myqcloud.com',
        encodedObjectKey: 'folder/file.png',
      }
      const result = strategy.resolve(context)
      expect(result.requestHost).toBe('my-bucket.cos.ap-guangzhou.myqcloud.com')
      expect(result.canonicalUri).toBe('/folder/file.png')
    })
  })

  describe('DefaultS3EndpointStrategy', () => {
    const strategy = new DefaultS3EndpointStrategy()

    it('should always match', () => {
      expect(strategy.matches('anything.com', 'any-bucket')).toBe(true)
    })

    it('should use virtual-hosted style when host starts with bucket name', () => {
      const context: S3EndpointContext = {
        protocol: 'https:',
        host: 'my-bucket.s3.us-east-1.amazonaws.com',
        bucket: 'my-bucket',
        endpoint: 'https://my-bucket.s3.us-east-1.amazonaws.com',
        encodedObjectKey: 'folder/file.png',
      }
      const result = strategy.resolve(context)
      expect(result.requestHost).toBe('my-bucket.s3.us-east-1.amazonaws.com')
      expect(result.canonicalUri).toBe('/folder/file.png')
      expect(result.baseUrl).toBe(context.endpoint)
    })

    it('should use path style when host does not start with bucket name', () => {
      const context: S3EndpointContext = {
        protocol: 'https:',
        host: 's3.us-east-1.amazonaws.com',
        bucket: 'my-bucket',
        endpoint: 'https://s3.us-east-1.amazonaws.com',
        encodedObjectKey: 'folder/file.png',
      }
      const result = strategy.resolve(context)
      expect(result.requestHost).toBe('s3.us-east-1.amazonaws.com')
      expect(result.canonicalUri).toBe('/my-bucket/folder/file.png')
      expect(result.baseUrl).toBe(context.endpoint)
    })
  })

  describe('registerStrategy', () => {
    it('should apply a custom strategy before the default one', async () => {
      const customStrategy = {
        matches: (host: string) => host === 'custom-provider.com',
        resolve: (ctx: S3EndpointContext) => ({
          requestHost: ctx.host,
          canonicalUri: `/custom/${ctx.encodedObjectKey}`,
          baseUrl: ctx.endpoint,
        }),
      }

      const customUploader = new S3Uploader({
        ...options,
        endpoint: 'https://custom-provider.com',
      })
      customUploader.registerStrategy(customStrategy)

      await customUploader.uploadToS3('test-object', mockBuffer, 'text/plain')
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/custom/test-object'),
        expect.anything(),
      )
    })

    it('should fall back to default strategy when no custom strategy matches', async () => {
      const nonMatchingStrategy = {
        matches: () => false,
        resolve: () => ({ requestHost: 'x', canonicalUri: '/x', baseUrl: 'x' }),
      }
      uploader.registerStrategy(nonMatchingStrategy)

      await uploader.uploadToS3('test-object', mockBuffer, 'text/plain')
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/test-bucket/test-object'),
        expect.anything(),
      )
    })
  })
})
