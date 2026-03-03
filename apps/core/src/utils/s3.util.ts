import * as crypto from 'node:crypto'
import { isDev } from '~/global/env.global'

export interface S3UploaderOptions {
  bucket: string
  region: string
  accessKey: string
  secretKey: string
  endpoint?: string
}

export interface S3EndpointContext {
  protocol: string
  host: string
  bucket: string
  endpoint: string
  encodedObjectKey: string
}

export interface S3EndpointResolution {
  requestHost: string
  canonicalUri: string
  baseUrl: string
}

export interface S3EndpointStrategy {
  matches: (host: string, bucket: string) => boolean
  resolve: (context: S3EndpointContext) => S3EndpointResolution
}

export class TencentCosEndpointStrategy implements S3EndpointStrategy {
  matches(host: string): boolean {
    return (
      host === 'myqcloud.com' ||
      host.endsWith('.myqcloud.com') ||
      host.includes('.cos.')
    )
  }

  resolve({
    protocol,
    host,
    bucket,
    encodedObjectKey,
  }: S3EndpointContext): S3EndpointResolution {
    let requestHost = host
    const cosMatch = host.match(/^cos\.(.+)$/)
    if (cosMatch) {
      requestHost = `${bucket}.cos.${cosMatch[1]}`
    }
    return {
      requestHost,
      canonicalUri: `/${encodedObjectKey}`,
      baseUrl: `${protocol}//${requestHost}`,
    }
  }
}

export class DefaultS3EndpointStrategy implements S3EndpointStrategy {
  matches(_host: string, _bucket: string): boolean {
    return true
  }

  resolve({
    host,
    bucket,
    endpoint,
    encodedObjectKey,
  }: S3EndpointContext): S3EndpointResolution {
    const isVirtualHosted = host.startsWith(`${bucket}.`)
    return {
      requestHost: host,
      canonicalUri: isVirtualHosted
        ? `/${encodedObjectKey}`
        : `/${bucket}/${encodedObjectKey}`,
      baseUrl: endpoint,
    }
  }
}

export class S3Uploader {
  private options: S3UploaderOptions
  private customDomain: string = ''
  private strategies: S3EndpointStrategy[] = [
    new TencentCosEndpointStrategy(),
    new DefaultS3EndpointStrategy(),
  ]

  constructor(options: S3UploaderOptions) {
    this.options = options
  }

  registerStrategy(strategy: S3EndpointStrategy): this {
    // Insert before the default (fallback) strategy, which is always last
    this.strategies.splice(this.strategies.length - 1, 0, strategy)
    return this
  }

  private resolveEndpoint(
    url: URL,
    encodedObjectKey: string,
  ): S3EndpointResolution {
    const context: S3EndpointContext = {
      protocol: url.protocol,
      host: url.host,
      bucket: this.bucket,
      endpoint: this.endpoint,
      encodedObjectKey,
    }
    for (const strategy of this.strategies) {
      if (strategy.matches(url.host, this.bucket)) {
        return strategy.resolve(context)
      }
    }
    // Unreachable: DefaultS3EndpointStrategy always matches
    /* c8 ignore next */
    return new DefaultS3EndpointStrategy().resolve(context)
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

    // URI encode each path segment for signing
    const encodedObjectKey = objectKey
      .split('/')
      .map((seg) => encodeURIComponent(seg))
      .join('/')

    const { requestHost, canonicalUri, baseUrl } = this.resolveEndpoint(
      url,
      encodedObjectKey,
    )

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
    const requestUrl = `${baseUrl}${canonicalUri}`

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
