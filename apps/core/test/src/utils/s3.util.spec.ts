import { Readable } from 'node:stream'

import { describe, expect, it, vi } from 'vitest'

import { S3Uploader } from '~/utils/s3.util'

const PART_SIZE = 8 * 1024 * 1024

const createUploader = () =>
  new S3Uploader({
    bucket: 'test-bucket',
    region: 'auto',
    accessKey: 'ak',
    secretKey: 'sk',
    endpoint: 'https://example.r2.cloudflarestorage.com',
  })

describe('S3Uploader.uploadStream', () => {
  it('uploads equal-length non-trailing parts regardless of chunk boundaries', async () => {
    const uploader = createUploader()
    const partBodies: Buffer[] = []

    vi.spyOn(uploader as any, 'signedRequest').mockImplementation(
      async (options: any) => {
        if (options.method === 'POST' && 'uploads' in (options.query ?? {})) {
          return new Response('<UploadId>test-upload-id</UploadId>', {
            status: 200,
          })
        }
        if (options.method === 'PUT') {
          partBodies.push(Buffer.from(options.body))
          return new Response(null, {
            status: 200,
            headers: { etag: `"etag-${partBodies.length}"` },
          })
        }
        return new Response('<CompleteMultipartUploadResult/>', {
          status: 200,
        })
      },
    )

    const chunkSizes = [1_000_003, 777_777, 3_333_331, 65_536]
    const total = PART_SIZE * 2 + 123_456
    let seed = 0
    const input = Buffer.alloc(total)
    for (let i = 0; i < total; i++) input[i] = i % 251

    async function* generate() {
      let offset = 0
      while (offset < total) {
        const size = Math.min(chunkSizes[seed++ % chunkSizes.length], total - offset)
        yield input.subarray(offset, offset + size)
        offset += size
      }
    }

    await uploader.uploadStream(
      Readable.from(generate()),
      'videos/test.mp4',
      'video/mp4',
    )

    expect(partBodies.length).toBeGreaterThanOrEqual(3)
    for (const part of partBodies.slice(0, -1)) {
      expect(part.length).toBe(PART_SIZE)
    }
    expect(Buffer.concat(partBodies).equals(input)).toBe(true)
  })

  it('uploads a single empty part for an empty stream', async () => {
    const uploader = createUploader()
    const partBodies: Buffer[] = []

    vi.spyOn(uploader as any, 'signedRequest').mockImplementation(
      async (options: any) => {
        if (options.method === 'POST' && 'uploads' in (options.query ?? {})) {
          return new Response('<UploadId>test-upload-id</UploadId>', {
            status: 200,
          })
        }
        if (options.method === 'PUT') {
          partBodies.push(Buffer.from(options.body))
          return new Response(null, {
            status: 200,
            headers: { etag: `"etag-${partBodies.length}"` },
          })
        }
        return new Response('<CompleteMultipartUploadResult/>', {
          status: 200,
        })
      },
    )

    await uploader.uploadStream(Readable.from([]), 'files/empty.bin', 'application/octet-stream')

    expect(partBodies.length).toBe(1)
    expect(partBodies[0].length).toBe(0)
  })
})
