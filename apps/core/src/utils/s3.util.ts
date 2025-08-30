import * as crypto from 'node:crypto'
import { extname } from 'node:path'

export interface S3UploaderOptions {
  bucket: string
  region: string
  accessKey: string
  secretKey: string
  endpoint?: string
}

export class S3Uploader {
  private options: S3UploaderOptions
  private customDomain: string = ''

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

  async uploadImage(imageData: Buffer, path: string): Promise<string> {
    const md5Filename = crypto.createHash('md5').update(imageData).digest('hex')
    const objectKey = `${path}/${md5Filename}.png`

    await this.uploadToS3(objectKey, imageData, 'image/png')

    if (this.customDomain && this.customDomain.length > 0) {
      return `${this.customDomain}/${objectKey}`
    }
    return `${path}/${objectKey}`
  }

  async uploadFile(fileData: Buffer, path: string): Promise<string> {
    const md5Filename = crypto.createHash('md5').update(fileData).digest('hex')
    const ext = extname(path)
    const objectKey = `${path}/${md5Filename}${ext}`
    await this.uploadToS3(objectKey, fileData, 'application/octet-stream')
    return `${path}/${objectKey}`
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
    const contentLength = fileData.length.toString()

    const headers: Record<string, string> = {
      Host: host,
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
      `/${this.bucket}/${objectKey}`,
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
    const requestUrl = `${this.endpoint}/${this.bucket}/${objectKey}`

    const response = await fetch(requestUrl, {
      method: 'PUT',
      headers: {
        ...headers,
        Authorization: authorization,
      },

      body: toArrayBuffer(fileData),
    })

    if (!response.ok) {
      throw new Error(`Upload failed with status code: ${response.status}`)
    }
  }
}
function toArrayBuffer(buffer) {
  const arrayBuffer = new ArrayBuffer(buffer.length)
  const view = new Uint8Array(arrayBuffer)
  for (const [i, element] of buffer.entries()) {
    view[i] = element
  }
  return arrayBuffer
}
