import * as crypto from 'node:crypto'
import { isDev } from '~/global/env.global'

export interface S3UploaderOptions {
  bucket: string
  region: string
  accessKey: string
  secretKey: string
  endpoint?: string
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

  async uploadFile(
    fileData: Buffer,
    filename: string,
    dir?: string,
  ): Promise<string> {
    const objectKey = dir ? `${dir}/${filename}` : filename
    await this.uploadToS3(objectKey, fileData, 'application/octet-stream')
    return objectKey
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
      const response = await fetch(requestUrl, fetchOptions as RequestInit)

      if (!response.ok) {
        const responseText = await response.text()
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
