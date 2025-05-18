import * as crypto from 'node:crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { S3UploaderOptions } from './s3.util'

import { S3Uploader } from './s3.util'

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
})
