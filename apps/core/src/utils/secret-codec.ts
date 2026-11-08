import crypto from 'node:crypto'

const PREFIX = '$${mx}$$'
const V2_PREFIX = `${PREFIX}v2.`

export const mapString = (key: string) => {
  if (!key || key.length > 64) throw new Error('Invalid encryption key length')
  return key.length === 64
    ? key
    : crypto.createHash('sha256').update(`${key}mx-encrypt-salt`).digest('hex')
}

export interface SecretCodecOptions {
  key: string
  enable: boolean
  v2: boolean
  algorithm?: string
}

/** No runtime config imports: usable by offline upgrade tools. */
export class SecretCodec {
  constructor(private readonly options: SecretCodecOptions) {}

  assertConfigured() {
    if (!this.options.enable) {
      throw new Error(
        'Secret encryption is disabled; set MX_ENCRYPT_ENABLE=true or ENCRYPT_ENABLE=true',
      )
    }
    if (!/^[\da-f]{64}$/i.test(this.options.key)) {
      throw new Error(
        'Storing secrets requires a 64-character hexadecimal encryption key',
      )
    }
  }

  isEncryptedString(value: string) {
    return value.startsWith(PREFIX)
  }

  encrypt<T>(data: T, context = ''): T {
    if (typeof data === 'string') {
      if (!data) return data
      // TODO(v18): remove the legacy plaintext escape hatch and require encryption.
      if (
        !this.options.enable &&
        !this.options.v2 &&
        !this.isEncryptedString(data)
      ) {
        return data
      }
      this.assertConfigured()
      let plain: string = data
      if (this.isEncryptedString(data)) {
        plain = this.decrypt(data, context)
        if (data.startsWith(V2_PREFIX) || !this.options.v2) return data
      }
      if (!plain) return '' as T
      const key = Buffer.from(this.options.key, 'hex')
      if (!this.options.v2) {
        const cipher = crypto.createCipheriv(
          this.options.algorithm || 'aes-256-ecb',
          key,
          '',
        )
        return (PREFIX +
          Buffer.concat([
            cipher.update(plain, 'utf8'),
            cipher.final(),
          ]).toString('base64')) as T
      }
      const keyId = crypto
        .createHash('sha256')
        .update(key)
        .digest('hex')
        .slice(0, 16)
      const nonce = crypto.randomBytes(12)
      const cipher = crypto.createCipheriv('aes-256-gcm', key, nonce)
      cipher.setAAD(Buffer.from(`mx:v2:${keyId}:${context}`))
      const ciphertext = Buffer.concat([
        cipher.update(plain, 'utf8'),
        cipher.final(),
      ])
      return `${V2_PREFIX}${keyId}.${nonce.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}.${ciphertext.toString('base64url')}` as T
    }
    if (Array.isArray(data)) {
      return data.map((value, index) =>
        this.encrypt(value, `${context}.${index}`),
      ) as T
    }
    if (data && typeof data === 'object') {
      return Object.fromEntries(
        Object.entries(data).map(([key, value]) => [
          key,
          this.encrypt(value, `${context}.${key}`),
        ]),
      ) as T
    }
    return data
  }

  decrypt<T>(data: T, context = ''): T {
    if (typeof data === 'string') {
      if (!this.isEncryptedString(data)) return data
      this.assertConfigured()
      const key = Buffer.from(this.options.key, 'hex')
      if (data.startsWith(V2_PREFIX)) {
        const parts = data.slice(V2_PREFIX.length).split('.')
        const [keyId, iv, tag, ciphertext] = parts
        if (parts.length !== 4 || !keyId || !iv || !tag || !ciphertext) {
          throw new Error('Malformed encrypted secret')
        }
        const expectedId = crypto
          .createHash('sha256')
          .update(key)
          .digest('hex')
          .slice(0, 16)
        const nonce = Buffer.from(iv, 'base64url')
        const authTag = Buffer.from(tag, 'base64url')
        if (
          keyId !== expectedId ||
          nonce.length !== 12 ||
          authTag.length !== 16
        ) {
          throw new Error('Invalid secret key or encrypted envelope')
        }
        const decipher = crypto.createDecipheriv('aes-256-gcm', key, nonce)
        decipher.setAAD(Buffer.from(`mx:v2:${keyId}:${context}`))
        decipher.setAuthTag(authTag)
        return Buffer.concat([
          decipher.update(Buffer.from(ciphertext, 'base64url')),
          decipher.final(),
        ]).toString('utf8') as T
      }
      if (!/^[\d+/a-z]+={0,2}$/i.test(data.slice(PREFIX.length))) {
        throw new Error('Unsupported encrypted secret format')
      }
      const decipher = crypto.createDecipheriv(
        this.options.algorithm || 'aes-256-ecb',
        key,
        '',
      )
      return Buffer.concat([
        decipher.update(Buffer.from(data.slice(PREFIX.length), 'base64')),
        decipher.final(),
      ]).toString('utf8') as T
    }
    if (Array.isArray(data)) {
      return data.map((value, index) =>
        this.decrypt(value, `${context}.${index}`),
      ) as T
    }
    if (data && typeof data === 'object') {
      return Object.fromEntries(
        Object.entries(data).map(([key, value]) => [
          key,
          this.decrypt(value, `${context}.${key}`),
        ]),
      ) as T
    }
    return data
  }
}
