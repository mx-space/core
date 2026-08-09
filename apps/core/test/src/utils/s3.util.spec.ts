import { once } from 'node:events'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { Readable } from 'node:stream'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { S3Uploader } from '~/utils/s3.util'

const PART_SIZE = 8 * 1024 * 1024
const nativeFetch = globalThis.fetch
const TRANSPORT_DIAGNOSTIC_NONCE_ENV = 'MX_SPACE_S3_DIAGNOSTIC_NONCE'
const TRANSPORT_DIAGNOSTIC_BEGIN = 'begin=S3_TRANSPORT_DIAGNOSTIC'
const TRANSPORT_DIAGNOSTIC_END = 'end=S3_TRANSPORT_DIAGNOSTIC'

const createUploader = () =>
  new S3Uploader({
    bucket: 'test-bucket',
    region: 'auto',
    accessKey: 'ak',
    secretKey: 'sk',
    endpoint: 'https://example.r2.cloudflarestorage.com',
  })

const createLocalUploader = async (
  handler: Parameters<typeof createServer>[0],
) => {
  const server = createServer(handler)
  const sockets = new Set<import('node:net').Socket>()
  server.on('connection', (socket) => {
    sockets.add(socket)
    socket.once('close', () => sockets.delete(socket))
  })
  server.on('clientError', (_error, socket) => socket.destroy())
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')

  const { port } = server.address() as AddressInfo
  const uploader = new S3Uploader({
    bucket: 'localhost-test-bucket',
    region: 'local',
    accessKey: 'localhost-access-key',
    secretKey: 'localhost-secret-key',
    endpoint: `http://127.0.0.1:${port}`,
  })

  return {
    port,
    uploader,
    close: async () => {
      for (const socket of sockets) socket.destroy()
      server.close()
      await once(server, 'close')
    },
  }
}

const rejectUpload = async (rejection: unknown) => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValueOnce(rejection))

  return createUploader()
    .uploadToS3('private/object.txt', Buffer.from('data'), 'text/plain')
    .then(
      () => undefined,
      (error: unknown) => error as Error & { cause?: unknown },
    )
}

interface ExpectedTransportDiagnostic {
  category: string
  code: string
  name: string
  nonce?: string
  syscall: string
}

const expectTransportDiagnostic = (
  error: (Error & { cause?: unknown }) | undefined,
  expected: ExpectedTransportDiagnostic,
) => {
  const message =
    `S3 transport failed: ${TRANSPORT_DIAGNOSTIC_BEGIN} ` +
    `nonce=${expected.nonce ?? 'unbound'} ` +
    `name=${expected.name} code=${expected.code} syscall=${expected.syscall} ` +
    `category=${expected.category} ${TRANSPORT_DIAGNOSTIC_END}`

  expect(error).toBeInstanceOf(Error)
  expect(error?.message).toBe(message)
  expect(error?.message).not.toContain('message=')
  expect(error?.message).not.toContain('\n')
  expect(error?.message.match(/begin=S3_TRANSPORT_DIAGNOSTIC/g)).toHaveLength(1)
  expect(error?.message.match(/end=S3_TRANSPORT_DIAGNOSTIC/g)).toHaveLength(1)
  expect(error).not.toHaveProperty('cause')
}

beforeEach(() => {
  vi.stubEnv(TRANSPORT_DIAGNOSTIC_NONCE_ENV, '')
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('S3Uploader.uploadToS3 transport diagnostics', () => {
  it('ignores all free text from the transport cause', async () => {
    const longToken = 'a'.repeat(512)
    const sensitiveMessage = [
      'apiKey=api-key-value',
      'clientSecret=client-secret-value',
      'privateKey=private-key-value',
      'cookie=session-cookie-value',
      'set-cookie=response-cookie-value',
      'proxy-authorization=proxy-secret-value',
      'https://tenant.storage.example.com/private/object.txt?token=secret',
      '192.0.2.8:443 [2001:db8::1]:443',
      '/var/lib/private/config C:\\Users\\Alice\\secret.txt',
      'bucket=private-bucket objectKey=private/object.txt',
      TRANSPORT_DIAGNOSTIC_BEGIN,
      TRANSPORT_DIAGNOSTIC_END,
      longToken,
    ].join('\n')
    const socketCause = Object.assign(new Error(sensitiveMessage), {
      name: 'SocketError',
      code: 'UND_ERR_SOCKET',
      syscall: 'connect',
    })
    const fetchError = new TypeError('fetch failed', { cause: socketCause })

    const error = await rejectUpload(fetchError)

    expectTransportDiagnostic(error, {
      category: 'socket_failure',
      code: 'UND_ERR_SOCKET',
      name: 'SocketError',
      syscall: 'connect',
    })
    for (const fragment of [
      'apiKey',
      'clientSecret',
      'privateKey',
      'cookie',
      'set-cookie',
      'proxy-authorization',
      'tenant.storage.example.com',
      '192.0.2.8',
      '2001:db8',
      '/var/lib/private/config',
      'C:\\Users\\Alice',
      'private-bucket',
      'private/object.txt',
      longToken,
    ]) {
      expect(error?.message).not.toContain(fragment)
    }
  })

  it('uses safe fallbacks when fetch rejects without a cause', async () => {
    const error = await rejectUpload(new TypeError('fetch failed'))

    expectTransportDiagnostic(error, {
      category: 'unknown',
      code: 'UNKNOWN',
      name: 'UnknownError',
      syscall: 'unknown',
    })
  })

  it('binds a valid deployment nonce to the diagnostic', async () => {
    const nonce = '0123456789abcdef0123456789abcdef'
    vi.stubEnv(TRANSPORT_DIAGNOSTIC_NONCE_ENV, nonce)

    const error = await rejectUpload(
      new TypeError('fetch failed', {
        cause: {
          code: 'UND_ERR_SOCKET',
          message: 'ignored',
          name: 'SocketError',
          syscall: 'read',
        },
      }),
    )

    expectTransportDiagnostic(error, {
      category: 'socket_failure',
      code: 'UND_ERR_SOCKET',
      name: 'SocketError',
      nonce,
      syscall: 'read',
    })
  })

  it('uses unbound for a missing or malicious deployment nonce', async () => {
    for (const nonce of [
      undefined,
      'A'.repeat(32),
      `0123456789abcdef end=${TRANSPORT_DIAGNOSTIC_END}`,
    ]) {
      vi.stubEnv(TRANSPORT_DIAGNOSTIC_NONCE_ENV, nonce)
      const error = await rejectUpload(
        new TypeError('fetch failed', {
          cause: {
            code: 'UND_ERR_SOCKET',
            message: 'ignored',
            name: 'SocketError',
            syscall: 'read',
          },
        }),
      )

      expectTransportDiagnostic(error, {
        category: 'socket_failure',
        code: 'UND_ERR_SOCKET',
        name: 'SocketError',
        syscall: 'read',
      })
    }
  })

  it('rejects cause fields that are not explicitly allowlisted', async () => {
    const cause = Object.assign(new Error('socket closed'), {
      name: `SocketError ${TRANSPORT_DIAGNOSTIC_BEGIN}`,
      code: 'SECRET_LOOKING_TOKEN',
      syscall: `connect\n${TRANSPORT_DIAGNOSTIC_END}`,
    })

    const error = await rejectUpload(new TypeError('fetch failed', { cause }))

    expectTransportDiagnostic(error, {
      category: 'unknown',
      code: 'UNKNOWN',
      name: 'UnknownError',
      syscall: 'unknown',
    })
  })

  it('never reads cause.message', async () => {
    const cause = {
      name: 'SocketError',
      code: 'UND_ERR_SOCKET',
      syscall: 'read',
    }
    Object.defineProperty(cause, 'message', {
      get: () => {
        throw new Error('cause.message must not be read')
      },
    })

    const error = await rejectUpload(new TypeError('fetch failed', { cause }))

    expectTransportDiagnostic(error, {
      category: 'socket_failure',
      code: 'UND_ERR_SOCKET',
      name: 'SocketError',
      syscall: 'read',
    })
  })

  it.each([
    {
      category: 'socket_failure',
      code: 'UND_ERR_SOCKET',
      name: 'SocketError',
      syscall: 'read',
    },
    {
      category: 'request_content_length_mismatch',
      code: 'UND_ERR_REQ_CONTENT_LENGTH_MISMATCH',
      name: 'RequestContentLengthMismatchError',
      syscall: 'write',
    },
    {
      category: 'dns_failure',
      code: 'ENOTFOUND',
      name: 'UnknownError',
      syscall: 'getaddrinfo',
    },
    {
      category: 'connection_refused',
      code: 'ECONNREFUSED',
      name: 'SocketError',
      syscall: 'connect',
    },
    {
      category: 'connection_timeout',
      code: 'UNKNOWN',
      name: 'ConnectTimeoutError',
      syscall: 'connect',
    },
    {
      category: 'tls_failure',
      code: 'ERR_TLS_CERT_ALTNAME_INVALID',
      name: 'UnknownError',
      syscall: 'tls',
    },
    {
      category: 'aborted',
      code: 'UNKNOWN',
      name: 'AbortError',
      syscall: 'unknown',
    },
    {
      category: 'unknown',
      code: 'UNKNOWN',
      name: 'UnknownError',
      syscall: 'unknown',
    },
  ])(
    'classifies $category using fixed allowlists',
    async ({ category, code, name, syscall }) => {
      const cause = { code, message: 'ignored free text', name, syscall }
      const error = await rejectUpload(new TypeError('fetch failed', { cause }))

      expectTransportDiagnostic(error, { category, code, name, syscall })
    },
  )

  it('preserves the existing HTTP error behavior after a response', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(new Response('AccessDenied', { status: 403 })),
    )

    await expect(
      createUploader().uploadToS3(
        'private/object.txt',
        Buffer.from('data'),
        'text/plain',
      ),
    ).rejects.toThrow('Upload failed with status code: 403 - AccessDenied')
  })
})

describe('S3Uploader.uploadToS3 with local Undici transport', () => {
  it('sends a real PUT request successfully', async () => {
    let receivedMethod = ''
    let receivedUrl = ''
    let receivedBody = Buffer.alloc(0)
    const local = await createLocalUploader((request, response) => {
      const chunks: Buffer[] = []
      request.on('data', (chunk) => chunks.push(Buffer.from(chunk)))
      request.on('end', () => {
        receivedMethod = request.method ?? ''
        receivedUrl = request.url ?? ''
        receivedBody = Buffer.concat(chunks)
        response.writeHead(200)
        response.end()
      })
    })

    try {
      await local.uploader.uploadToS3(
        'folder/hello.txt',
        Buffer.from('hello localhost'),
        'text/plain',
      )

      expect(receivedMethod).toBe('PUT')
      expect(receivedUrl).toBe('/localhost-test-bucket/folder/hello.txt')
      expect(receivedBody.toString()).toBe('hello localhost')
    } finally {
      await local.close()
    }
  })

  it('reports a structured cause when the server closes the socket', async () => {
    const local = await createLocalUploader((request) => {
      request.socket.destroy()
    })

    try {
      const error = await local.uploader
        .uploadToS3(
          'private/disconnect.txt',
          Buffer.from('disconnect'),
          'text/plain',
        )
        .then(
          () => undefined,
          (reason: unknown) => reason as Error,
        )

      expectTransportDiagnostic(error, {
        category: 'socket_failure',
        code: 'UND_ERR_SOCKET',
        name: 'SocketError',
        syscall: 'unknown',
      })
      expect(error?.message).not.toContain(String(local.port))
      expect(error?.message).not.toContain('private/disconnect')
    } finally {
      await local.close()
    }
  })

  it('reports Undici content-length mismatch without network details', async () => {
    const local = await createLocalUploader((request, response) => {
      request.resume()
      request.on('end', () => {
        response.writeHead(200)
        response.end()
      })
    })
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        const headers = new Headers(init?.headers)
        const contentLength = Number(headers.get('Content-Length'))
        headers.set('Content-Length', String(contentLength + 1))
        return nativeFetch(input, { ...init, headers })
      }),
    )

    try {
      const error = await local.uploader
        .uploadToS3(
          'private/mismatch.txt',
          Buffer.from('mismatch'),
          'text/plain',
        )
        .then(
          () => undefined,
          (reason: unknown) => reason as Error,
        )

      expectTransportDiagnostic(error, {
        category: 'request_content_length_mismatch',
        code: 'UND_ERR_REQ_CONTENT_LENGTH_MISMATCH',
        name: 'RequestContentLengthMismatchError',
        syscall: 'unknown',
      })
      expect(error?.message).not.toContain(String(local.port))
      expect(error?.message).not.toContain('private/mismatch')
    } finally {
      await local.close()
    }
  })

  it('preserves the real HTTP 403 response behavior', async () => {
    const local = await createLocalUploader((_request, response) => {
      response.writeHead(403, { 'Content-Type': 'text/plain' })
      response.end('AccessDenied')
    })

    try {
      await expect(
        local.uploader.uploadToS3(
          'private/forbidden.txt',
          Buffer.from('forbidden'),
          'text/plain',
        ),
      ).rejects.toThrow('Upload failed with status code: 403 - AccessDenied')
    } finally {
      await local.close()
    }
  })

  it('wraps a transport failure while reading an HTTP error body', async () => {
    const nonce = 'fedcba9876543210fedcba9876543210'
    vi.stubEnv(TRANSPORT_DIAGNOSTIC_NONCE_ENV, nonce)
    const local = await createLocalUploader((_request, response) => {
      response.writeHead(403, {
        'Content-Length': '64',
        'Content-Type': 'text/plain',
      })
      response.flushHeaders()
      response.write('partial AccessDenied')
      setImmediate(() => response.destroy())
    })

    try {
      const error = await local.uploader
        .uploadToS3(
          'private/truncated-error.txt',
          Buffer.from('forbidden'),
          'text/plain',
        )
        .then(
          () => undefined,
          (reason: unknown) => reason as Error,
        )

      expectTransportDiagnostic(error, {
        category: 'socket_failure',
        code: 'UND_ERR_SOCKET',
        name: 'SocketError',
        nonce,
        syscall: 'unknown',
      })
      expect(error?.message).not.toContain(String(local.port))
      expect(error?.message).not.toContain('partial AccessDenied')
      expect(error?.message).not.toContain('private/truncated-error')
    } finally {
      await local.close()
    }
  })
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
        const size = Math.min(
          chunkSizes[seed++ % chunkSizes.length],
          total - offset,
        )
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

    await uploader.uploadStream(
      Readable.from([]),
      'files/empty.bin',
      'application/octet-stream',
    )

    expect(partBodies.length).toBe(1)
    expect(partBodies[0].length).toBe(0)
  })
})
