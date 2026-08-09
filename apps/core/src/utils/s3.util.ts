import * as crypto from 'node:crypto'
import type { Readable } from 'node:stream'

import { isDev } from '~/global/env.global'

export interface S3UploaderOptions {
  bucket: string
  region: string
  accessKey: string
  secretKey: string
  endpoint?: string
}

const S3_TRANSPORT_DIAGNOSTIC_BEGIN = 'begin=S3_TRANSPORT_DIAGNOSTIC'
const S3_TRANSPORT_DIAGNOSTIC_END = 'end=S3_TRANSPORT_DIAGNOSTIC'
// Keep the deployment contract's lowercase hexadecimal grammar literal.
// eslint-disable-next-line unicorn/better-regex
const S3_TRANSPORT_DIAGNOSTIC_NONCE_PATTERN = /^[0-9a-f]{32}$/

const S3_TRANSPORT_NAMES = [
  'AbortError',
  'BodyTimeoutError',
  'ConnectTimeoutError',
  'HeadersTimeoutError',
  'RequestContentLengthMismatchError',
  'SocketError',
  'TimeoutError',
  'UnknownError',
] as const

const S3_TRANSPORT_CODES = [
  'ABORT_ERR',
  'CERT_HAS_EXPIRED',
  'DEPTH_ZERO_SELF_SIGNED_CERT',
  'EAI_AGAIN',
  'ECONNREFUSED',
  'ECONNRESET',
  'EHOSTUNREACH',
  'ENETUNREACH',
  'ENOTFOUND',
  'EPIPE',
  'ERR_SSL_WRONG_VERSION_NUMBER',
  'ERR_TLS_CERT_ALTNAME_INVALID',
  'ETIMEDOUT',
  'SELF_SIGNED_CERT_IN_CHAIN',
  'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
  'UND_ERR_ABORTED',
  'UND_ERR_BODY_TIMEOUT',
  'UND_ERR_CLOSED',
  'UND_ERR_CONNECT_TIMEOUT',
  'UND_ERR_DESTROYED',
  'UND_ERR_HEADERS_TIMEOUT',
  'UND_ERR_REQ_CONTENT_LENGTH_MISMATCH',
  'UND_ERR_SOCKET',
  'UNKNOWN',
] as const

const S3_TRANSPORT_SYSCALLS = [
  'connect',
  'getaddrinfo',
  'lookup',
  'read',
  'recv',
  'send',
  'socket',
  'tls',
  'unknown',
  'write',
] as const

type S3TransportName = (typeof S3_TRANSPORT_NAMES)[number]
type S3TransportCode = (typeof S3_TRANSPORT_CODES)[number]
type S3TransportSyscall = (typeof S3_TRANSPORT_SYSCALLS)[number]
type S3TransportCategory =
  | 'aborted'
  | 'connection_refused'
  | 'connection_timeout'
  | 'dns_failure'
  | 'request_content_length_mismatch'
  | 'socket_failure'
  | 'tls_failure'
  | 'unknown'

const S3_TRANSPORT_NAME_ALLOWLIST = new Set<string>(S3_TRANSPORT_NAMES)
const S3_TRANSPORT_CODE_ALLOWLIST = new Set<string>(S3_TRANSPORT_CODES)
const S3_TRANSPORT_SYSCALL_ALLOWLIST = new Set<string>(S3_TRANSPORT_SYSCALLS)

const S3_TRANSPORT_CODE_CATEGORY = {
  ABORT_ERR: 'aborted',
  CERT_HAS_EXPIRED: 'tls_failure',
  DEPTH_ZERO_SELF_SIGNED_CERT: 'tls_failure',
  EAI_AGAIN: 'dns_failure',
  ECONNREFUSED: 'connection_refused',
  ECONNRESET: 'socket_failure',
  EHOSTUNREACH: 'socket_failure',
  ENETUNREACH: 'socket_failure',
  ENOTFOUND: 'dns_failure',
  EPIPE: 'socket_failure',
  ERR_SSL_WRONG_VERSION_NUMBER: 'tls_failure',
  ERR_TLS_CERT_ALTNAME_INVALID: 'tls_failure',
  ETIMEDOUT: 'connection_timeout',
  SELF_SIGNED_CERT_IN_CHAIN: 'tls_failure',
  UNABLE_TO_VERIFY_LEAF_SIGNATURE: 'tls_failure',
  UND_ERR_ABORTED: 'aborted',
  UND_ERR_BODY_TIMEOUT: 'connection_timeout',
  UND_ERR_CLOSED: 'socket_failure',
  UND_ERR_CONNECT_TIMEOUT: 'connection_timeout',
  UND_ERR_DESTROYED: 'socket_failure',
  UND_ERR_HEADERS_TIMEOUT: 'connection_timeout',
  UND_ERR_REQ_CONTENT_LENGTH_MISMATCH: 'request_content_length_mismatch',
  UND_ERR_SOCKET: 'socket_failure',
} satisfies Partial<Record<S3TransportCode, S3TransportCategory>>

const S3_TRANSPORT_NAME_CATEGORY = {
  AbortError: 'aborted',
  BodyTimeoutError: 'connection_timeout',
  ConnectTimeoutError: 'connection_timeout',
  HeadersTimeoutError: 'connection_timeout',
  RequestContentLengthMismatchError: 'request_content_length_mismatch',
  SocketError: 'socket_failure',
  TimeoutError: 'connection_timeout',
} satisfies Partial<Record<S3TransportName, S3TransportCategory>>

const toAllowedTransportValue = <T extends string>(
  value: unknown,
  allowlist: ReadonlySet<string>,
  fallback: T,
): T =>
  typeof value === 'string' && allowlist.has(value) ? (value as T) : fallback

const readCauseField = (
  cause: Record<string, unknown> | undefined,
  field: 'name' | 'code' | 'syscall',
): unknown => {
  try {
    return cause?.[field]
  } catch {
    return undefined
  }
}

const getErrorCause = (error: unknown): Record<string, unknown> | undefined => {
  if (typeof error !== 'object' || error === null) return undefined

  try {
    const cause = (error as { cause?: unknown }).cause
    return typeof cause === 'object' && cause !== null
      ? (cause as Record<string, unknown>)
      : undefined
  } catch {
    return undefined
  }
}

const classifyS3TransportError = (
  name: S3TransportName,
  code: S3TransportCode,
): S3TransportCategory =>
  S3_TRANSPORT_CODE_CATEGORY[code as keyof typeof S3_TRANSPORT_CODE_CATEGORY] ??
  S3_TRANSPORT_NAME_CATEGORY[name as keyof typeof S3_TRANSPORT_NAME_CATEGORY] ??
  'unknown'

const getS3TransportDiagnosticNonce = (): string => {
  const nonce = process.env.MX_SPACE_S3_DIAGNOSTIC_NONCE
  return typeof nonce === 'string' &&
    S3_TRANSPORT_DIAGNOSTIC_NONCE_PATTERN.test(nonce)
    ? nonce
    : 'unbound'
}

const createS3TransportError = (error: unknown): Error => {
  const cause = getErrorCause(error)
  const name = toAllowedTransportValue<S3TransportName>(
    readCauseField(cause, 'name'),
    S3_TRANSPORT_NAME_ALLOWLIST,
    'UnknownError',
  )
  const code = toAllowedTransportValue<S3TransportCode>(
    readCauseField(cause, 'code'),
    S3_TRANSPORT_CODE_ALLOWLIST,
    'UNKNOWN',
  )
  const syscall = toAllowedTransportValue<S3TransportSyscall>(
    readCauseField(cause, 'syscall'),
    S3_TRANSPORT_SYSCALL_ALLOWLIST,
    'unknown',
  )
  const category = classifyS3TransportError(name, code)
  const nonce = getS3TransportDiagnosticNonce()

  return new Error(
    `S3 transport failed: ${S3_TRANSPORT_DIAGNOSTIC_BEGIN} nonce=${nonce} name=${name} code=${code} syscall=${syscall} category=${category} ${S3_TRANSPORT_DIAGNOSTIC_END}`,
  )
}

/**
 * Resolved endpoint information used for signing and sending S3 requests.
 */
export interface S3ResolvedEndpoint {
  /** The Host header value */
  requestHost: string
  /** The canonical URI used for AWS Signature V4 signing */
  canonicalUri: string
  /** The base URL (scheme + host) for the final HTTP request */
  baseUrl: string
}

/**
 * Extensible strategy interface for resolving S3-compatible endpoint styles.
 *
 * Implement this interface to add support for additional S3-compatible storage
 * providers that require custom host / URI resolution (e.g. virtual-hosted
 * style, path style, or provider-specific conventions).
 */
export interface S3EndpointStrategy {
  /** Human-readable name for debugging / logging */
  readonly name: string

  /**
   * Return `true` when this strategy should handle the given host.
   * Strategies are evaluated in registration order; the first match wins.
   */
  matches: (host: string) => boolean

  /**
   * Resolve the request host, canonical URI, and base URL for the given
   * endpoint information.
   */
  resolve: (ctx: {
    host: string
    bucket: string
    encodedObjectKey: string
    protocol: string
  }) => S3ResolvedEndpoint
}

// ---------------------------------------------------------------------------
// Built-in strategies
// ---------------------------------------------------------------------------

/**
 * Strategy for Tencent Cloud COS.
 *
 * Converts `cos.<region>.myqcloud.com` → `<bucket>.cos.<region>.myqcloud.com`
 * (virtual-hosted style) and uses `/<key>` as the canonical URI.
 */
export class TencentCosStrategy implements S3EndpointStrategy {
  readonly name = 'TencentCOS'

  matches(host: string): boolean {
    return host.includes('myqcloud.com') || host.includes('.cos.')
  }

  resolve(ctx: {
    host: string
    bucket: string
    encodedObjectKey: string
    protocol: string
  }): S3ResolvedEndpoint {
    let requestHost = ctx.host
    const cosMatch = ctx.host.match(/^cos\.(.+)$/)
    if (cosMatch) {
      requestHost = `${ctx.bucket}.cos.${cosMatch[1]}`
    }
    return {
      requestHost,
      canonicalUri: `/${ctx.encodedObjectKey}`,
      baseUrl: `${ctx.protocol}//${requestHost}`,
    }
  }
}

/**
 * Default strategy for AWS S3 and most S3-compatible services.
 *
 * - If the host already starts with `<bucket>.`, it assumes virtual-hosted
 *   style and uses `/<key>` as the canonical URI.
 * - Otherwise it falls back to path style: `/<bucket>/<key>`.
 */
export class DefaultS3Strategy implements S3EndpointStrategy {
  readonly name = 'DefaultS3'

  /** Always matches – used as the fallback strategy. */
  matches(_host: string): boolean {
    return true
  }

  resolve(ctx: {
    host: string
    bucket: string
    encodedObjectKey: string
    protocol: string
  }): S3ResolvedEndpoint {
    const isVirtualHosted = ctx.host.startsWith(`${ctx.bucket}.`)
    const canonicalUri = isVirtualHosted
      ? `/${ctx.encodedObjectKey}`
      : `/${ctx.bucket}/${ctx.encodedObjectKey}`
    return {
      requestHost: ctx.host,
      canonicalUri,
      baseUrl: `${ctx.protocol}//${ctx.host}`,
    }
  }
}

export class S3Uploader {
  private options: S3UploaderOptions
  private customDomain: string = ''

  /**
   * Ordered list of endpoint strategies. The first strategy whose `matches()`
   * returns `true` is used. The {@link DefaultS3Strategy} is always appended
   * as a fallback.
   */
  private static globalStrategies: S3EndpointStrategy[] = [
    new TencentCosStrategy(),
  ]

  /**
   * Register a custom endpoint strategy. Strategies registered earlier take
   * precedence. The built-in {@link DefaultS3Strategy} is always evaluated
   * last, so you do not need to worry about ordering relative to it.
   */
  static registerStrategy(strategy: S3EndpointStrategy): void {
    S3Uploader.globalStrategies.push(strategy)
  }

  /**
   * Remove all custom strategies and reset to defaults.
   * Useful in tests.
   */
  static resetStrategies(): void {
    S3Uploader.globalStrategies = [new TencentCosStrategy()]
  }

  private static readonly defaultStrategy = new DefaultS3Strategy()

  constructor(options: S3UploaderOptions) {
    this.options = options
  }

  get endpoint(): string {
    return (
      this.options.endpoint ||
      `https://${this.options.bucket}.s3.${this.options.region}.amazonaws.com`
    )
  }

  get bucket(): string {
    return this.options.bucket
  }

  get region(): string {
    return this.options.region
  }

  get accessKey(): string {
    return this.options.accessKey
  }

  get secretKey(): string {
    return this.options.secretKey
  }

  setOptions(options: S3UploaderOptions): void {
    this.options = options
  }

  setCustomDomain(domain: string): void {
    this.customDomain = domain
  }

  // Helper function to calculate HMAC-SHA256
  private hmacSha256(key: Buffer, message: string): Buffer {
    return crypto.createHmac('sha256', key).update(message).digest()
  }

  /**
   * Walk the strategy chain and return the first matching result.
   */
  private resolveEndpoint(
    host: string,
    encodedObjectKey: string,
    protocol: string,
  ): S3ResolvedEndpoint {
    const ctx = { host, bucket: this.bucket, encodedObjectKey, protocol }

    for (const strategy of S3Uploader.globalStrategies) {
      if (strategy.matches(host)) {
        return strategy.resolve(ctx)
      }
    }

    // Fallback – always matches
    return S3Uploader.defaultStrategy.resolve(ctx)
  }

  async uploadImage(imageData: Buffer, path: string): Promise<string> {
    const md5Filename = crypto.createHash('md5').update(imageData).digest('hex')
    const objectKey = `${path}/${md5Filename}.png`

    await this.uploadToS3(objectKey, imageData, 'image/png')

    if (this.customDomain && this.customDomain.length > 0) {
      return `${this.customDomain}/${objectKey}`
    }
    return `${path}/${objectKey}`
  }

  getPublicUrl(objectKey: string): string {
    if (this.customDomain && this.customDomain.length > 0) {
      return `${this.customDomain.replace(/\/+$/, '')}/${objectKey}`
    }
    return `${this.endpoint}/${this.bucket}/${objectKey}`
  }

  async uploadBuffer(
    buffer: Buffer,
    objectKey: string,
    contentType: string,
  ): Promise<string> {
    await this.uploadToS3(objectKey, buffer, contentType)
    return this.getPublicUrl(objectKey)
  }

  async uploadStream(
    stream: Readable,
    objectKey: string,
    contentType: string,
  ): Promise<string> {
    // S3 requires non-trailing parts >= 5MB; R2 additionally requires all
    // non-trailing parts to be exactly the same length, so parts are sliced
    // to exactly PART_SIZE instead of flushing on overflow
    const PART_SIZE = 8 * 1024 * 1024

    const initRes = await this.signedRequest({
      method: 'POST',
      objectKey,
      query: { uploads: '' },
      contentType,
    })
    const initBody = await initRes.text()
    if (!initRes.ok) {
      throw new Error(
        `Multipart upload init failed with status code: ${initRes.status} - ${initBody}`,
      )
    }
    const uploadId = /<UploadId>([^<]+)<\/UploadId>/.exec(initBody)?.[1]
    if (!uploadId) {
      throw new Error('Multipart upload init response missing UploadId')
    }

    try {
      const etags: string[] = []

      const uploadPart = async (body: Buffer) => {
        const partNumber = etags.length + 1
        const res = await this.signedRequest({
          method: 'PUT',
          objectKey,
          query: { partNumber: String(partNumber), uploadId },
          body,
        })
        if (!res.ok) {
          throw new Error(
            `Multipart part ${partNumber} failed with status code: ${res.status} - ${await res.text()}`,
          )
        }
        const etag = res.headers.get('etag')
        if (!etag) {
          throw new Error(`Multipart part ${partNumber} response missing ETag`)
        }
        etags.push(etag)
      }

      let pending: Buffer[] = []
      let pendingSize = 0
      for await (const chunk of stream) {
        const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
        pending.push(buf)
        pendingSize += buf.length
        while (pendingSize >= PART_SIZE) {
          const merged = Buffer.concat(pending)
          await uploadPart(merged.subarray(0, PART_SIZE))
          const rest = merged.subarray(PART_SIZE)
          pending = rest.length > 0 ? [rest] : []
          pendingSize = rest.length
        }
      }
      if (pendingSize > 0 || etags.length === 0) {
        await uploadPart(Buffer.concat(pending))
      }

      const completeXml = `<CompleteMultipartUpload>${etags
        .map(
          (etag, index) =>
            `<Part><PartNumber>${index + 1}</PartNumber><ETag>${etag}</ETag></Part>`,
        )
        .join('')}</CompleteMultipartUpload>`
      const completeRes = await this.signedRequest({
        method: 'POST',
        objectKey,
        query: { uploadId },
        body: Buffer.from(completeXml),
        contentType: 'application/xml',
      })
      const completeBody = await completeRes.text()
      if (!completeRes.ok || completeBody.includes('<Error>')) {
        throw new Error(
          `Multipart upload completion failed with status code: ${completeRes.status} - ${completeBody}`,
        )
      }

      return this.getPublicUrl(objectKey)
    } catch (err) {
      await this.signedRequest({
        method: 'DELETE',
        objectKey,
        query: { uploadId },
      }).catch(() => void 0)
      throw err
    }
  }

  private async signedRequest(options: {
    method: string
    objectKey: string
    query?: Record<string, string>
    body?: Buffer
    contentType?: string
  }): Promise<Response> {
    const { method, objectKey, query = {}, body, contentType } = options
    const service = 's3'
    const date = new Date()
    const xAmzDate = date.toISOString().replaceAll(/[:-]|\.\d{3}/g, '')
    const dateStamp = xAmzDate.slice(0, 8)

    const hashedPayload = crypto
      .createHash('sha256')
      .update(body ?? '')
      .digest('hex')

    const url = new URL(this.endpoint)

    const encodedObjectKey = objectKey
      .split('/')
      .map((seg) => encodeURIComponent(seg))
      .join('/')

    const resolved = this.resolveEndpoint(
      url.host,
      encodedObjectKey,
      url.protocol,
    )
    const { requestHost, canonicalUri } = resolved

    const canonicalQuery = Object.keys(query)
      .sort()
      .map(
        (key) => `${encodeURIComponent(key)}=${encodeURIComponent(query[key])}`,
      )
      .join('&')

    const headers: Record<string, string> = {
      Host: requestHost,
      'x-amz-date': xAmzDate,
      'x-amz-content-sha256': hashedPayload,
    }
    if (contentType) {
      headers['Content-Type'] = contentType
    }
    if (body) {
      headers['Content-Length'] = body.length.toString()
    }

    const sortedHeaders = Object.keys(headers).sort()
    const canonicalHeaders = sortedHeaders
      .map((key) => `${key.toLowerCase()}:${headers[key].trim()}`)
      .join('\n')
    const signedHeaders = sortedHeaders
      .map((key) => key.toLowerCase())
      .join(';')

    const canonicalRequest = [
      method,
      canonicalUri,
      canonicalQuery,
      String(canonicalHeaders),
      '',
      signedHeaders,
      hashedPayload,
    ].join('\n')

    const algorithm = 'AWS4-HMAC-SHA256'
    const credentialScope = `${dateStamp}/${this.region}/${service}/aws4_request`
    const hashedCanonicalRequest = crypto
      .createHash('sha256')
      .update(canonicalRequest)
      .digest('hex')
    const stringToSign = [
      algorithm,
      xAmzDate,
      credentialScope,
      hashedCanonicalRequest,
    ].join('\n')

    const kSecret = Buffer.from(`AWS4${this.secretKey}`)
    const kDate = this.hmacSha256(kSecret, dateStamp)
    const kRegion = this.hmacSha256(kDate, this.region)
    const kService = this.hmacSha256(kRegion, service)
    const kSigning = this.hmacSha256(kService, 'aws4_request')
    const signature = this.hmacSha256(kSigning, stringToSign).toString('hex')

    const authorization = `${algorithm} Credential=${this.accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`

    const requestUrl = `${resolved.baseUrl}${canonicalUri}${
      canonicalQuery ? `?${canonicalQuery}` : ''
    }`

    const fetchOptions: RequestInit = {
      method,
      headers: {
        ...headers,
        Authorization: authorization,
      },
      body: body ? new Uint8Array(body) : undefined,
    }

    let originalTlsReject: string | undefined
    if (isDev) {
      originalTlsReject = process.env.NODE_TLS_REJECT_UNAUTHORIZED
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
    }

    try {
      return await fetch(requestUrl, fetchOptions)
    } finally {
      if (isDev) {
        if (originalTlsReject === undefined) {
          delete process.env.NODE_TLS_REJECT_UNAUTHORIZED
        } else {
          process.env.NODE_TLS_REJECT_UNAUTHORIZED = originalTlsReject
        }
      }
    }
  }

  async uploadFile(
    fileData: Buffer,
    filename: string,
    dir?: string,
  ): Promise<string> {
    const objectKey = dir ? `${dir}/${filename}` : filename
    await this.uploadToS3(objectKey, fileData, 'application/octet-stream')
    return objectKey
  }

  async deleteObject(objectKey: string): Promise<void> {
    const service = 's3'
    const date = new Date()
    const xAmzDate = date.toISOString().replaceAll(/[:-]|\.\d{3}/g, '')
    const dateStamp = xAmzDate.slice(0, 8)

    const hashedPayload = crypto.createHash('sha256').update('').digest('hex')

    const url = new URL(this.endpoint)
    const host = url.host

    const encodedObjectKey = objectKey
      .split('/')
      .map((seg) => encodeURIComponent(seg))
      .join('/')
    const canonicalUri = `/${this.bucket}/${encodedObjectKey}`

    const headers: Record<string, string> = {
      Host: host,
      'x-amz-date': xAmzDate,
      'x-amz-content-sha256': hashedPayload,
    }

    const sortedHeaders = Object.keys(headers).sort()
    const canonicalHeaders = sortedHeaders
      .map((key) => `${key.toLowerCase()}:${headers[key].trim()}`)
      .join('\n')
    const signedHeaders = sortedHeaders
      .map((key) => key.toLowerCase())
      .join(';')

    const canonicalRequest = [
      'DELETE',
      canonicalUri,
      '',
      String(canonicalHeaders),
      '',
      signedHeaders,
      hashedPayload,
    ].join('\n')

    const algorithm = 'AWS4-HMAC-SHA256'
    const credentialScope = `${dateStamp}/${this.region}/${service}/aws4_request`
    const hashedCanonicalRequest = crypto
      .createHash('sha256')
      .update(canonicalRequest)
      .digest('hex')
    const stringToSign = [
      algorithm,
      xAmzDate,
      credentialScope,
      hashedCanonicalRequest,
    ].join('\n')

    const kSecret = Buffer.from(`AWS4${this.secretKey}`)
    const kDate = this.hmacSha256(kSecret, dateStamp)
    const kRegion = this.hmacSha256(kDate, this.region)
    const kService = this.hmacSha256(kRegion, service)
    const kSigning = this.hmacSha256(kService, 'aws4_request')
    const signature = this.hmacSha256(kSigning, stringToSign).toString('hex')

    const authorization = `${algorithm} Credential=${this.accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`

    const requestUrl = `${this.endpoint}${canonicalUri}`

    const fetchOptions: RequestInit & { dispatcher?: unknown } = {
      method: 'DELETE',
      headers: {
        ...headers,
        Authorization: authorization,
      },
    }

    let originalTlsReject: string | undefined
    if (isDev) {
      originalTlsReject = process.env.NODE_TLS_REJECT_UNAUTHORIZED
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
    }

    try {
      const response = await fetch(requestUrl, fetchOptions as RequestInit)

      if (response.status === 404) return
      if (!response.ok) {
        throw new Error(`Delete failed with status code: ${response.status}`)
      }
    } finally {
      if (isDev) {
        if (originalTlsReject === undefined) {
          delete process.env.NODE_TLS_REJECT_UNAUTHORIZED
        } else {
          process.env.NODE_TLS_REJECT_UNAUTHORIZED = originalTlsReject
        }
      }
    }
  }

  // Generic S3-compatible storage upload function
  async uploadToS3(
    objectKey: string,
    fileData: Buffer,
    contentType: string,
  ): Promise<void> {
    const service = 's3'
    const date = new Date()
    const xAmzDate = date.toISOString().replaceAll(/[:-]|\.\d{3}/g, '')
    const dateStamp = xAmzDate.slice(0, 8) // YYYYMMDD

    // Calculate hashed payload
    const hashedPayload = crypto
      .createHash('sha256')
      .update(fileData)
      .digest('hex')

    // Set request headers
    const url = new URL(this.endpoint)
    const host = url.host

    // URI encode each path segment for signing
    const encodedObjectKey = objectKey
      .split('/')
      .map((seg) => encodeURIComponent(seg))
      .join('/')

    // Resolve endpoint using the extensible strategy chain
    const resolved = this.resolveEndpoint(host, encodedObjectKey, url.protocol)
    const { requestHost, canonicalUri } = resolved

    const contentLength = fileData.length.toString()

    const headers: Record<string, string> = {
      Host: requestHost,
      'Content-Type': contentType,
      'Content-Length': contentLength,
      'x-amz-date': xAmzDate,
      'x-amz-content-sha256': hashedPayload,
    }

    // Create canonical request
    const sortedHeaders = Object.keys(headers).sort()
    const canonicalHeaders = sortedHeaders
      .map((key) => `${key.toLowerCase()}:${headers[key].trim()}`)
      .join('\n')
    const signedHeaders = sortedHeaders
      .map((key) => key.toLowerCase())
      .join(';')

    const canonicalRequest = [
      'PUT',
      canonicalUri,
      '', // No query parameters
      String(canonicalHeaders),
      '', // Extra newline
      signedHeaders,
      hashedPayload,
    ].join('\n')

    // Create string to sign
    const algorithm = 'AWS4-HMAC-SHA256'
    const credentialScope = `${dateStamp}/${this.region}/${service}/aws4_request`
    const hashedCanonicalRequest = crypto
      .createHash('sha256')
      .update(canonicalRequest)
      .digest('hex')
    const stringToSign = [
      algorithm,
      xAmzDate,
      credentialScope,
      hashedCanonicalRequest,
    ].join('\n')

    // Calculate signature
    const kSecret = Buffer.from(`AWS4${this.secretKey}`)
    const kDate = this.hmacSha256(kSecret, dateStamp)
    const kRegion = this.hmacSha256(kDate, this.region)
    const kService = this.hmacSha256(kRegion, service)
    const kSigning = this.hmacSha256(kService, 'aws4_request')
    const signature = this.hmacSha256(kSigning, stringToSign).toString('hex')

    // Assemble Authorization header
    const authorization = `${algorithm} Credential=${this.accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`

    // Create and send PUT request
    const requestUrl = `${resolved.baseUrl}${canonicalUri}`

    const fetchOptions: RequestInit & { dispatcher?: unknown } = {
      method: 'PUT',
      headers: {
        ...headers,
        Authorization: authorization,
      },
      body: new Uint8Array(fileData),
    }

    let originalTlsReject: string | undefined
    if (isDev) {
      originalTlsReject = process.env.NODE_TLS_REJECT_UNAUTHORIZED
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
    }

    try {
      let response: Response
      try {
        response = await fetch(requestUrl, fetchOptions as RequestInit)
      } catch (error) {
        throw createS3TransportError(error)
      }

      if (!response.ok) {
        let responseText: string
        try {
          responseText = await response.text()
        } catch (error) {
          throw createS3TransportError(error)
        }
        throw new Error(
          `Upload failed with status code: ${response.status} - ${responseText}`,
        )
      }
    } finally {
      if (isDev) {
        if (originalTlsReject === undefined) {
          delete process.env.NODE_TLS_REJECT_UNAUTHORIZED
        } else {
          process.env.NODE_TLS_REJECT_UNAUTHORIZED = originalTlsReject
        }
      }
    }
  }
}
