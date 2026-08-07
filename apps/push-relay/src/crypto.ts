import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto'

const ENVELOPE_VERSION = 'v1'

export const randomCredential = (prefix: string) =>
  `${prefix}_${randomBytes(32).toString('base64url')}`

export const credentialHash = (value: string) =>
  createHash('sha256').update(value).digest('hex')

export const credentialsMatch = (plain: string, expectedHash: string) => {
  const actual = Buffer.from(credentialHash(plain), 'hex')
  const expected = Buffer.from(expectedHash, 'hex')
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

const parseDataKey = (value: string) => {
  const decoded = /^[\da-f]{64}$/i.test(value)
    ? Buffer.from(value, 'hex')
    : Buffer.from(value, 'base64')
  if (decoded.length !== 32) {
    throw new Error('PUSH_RELAY_DATA_KEY must decode to exactly 32 bytes')
  }
  return decoded
}

export class DataVault {
  private readonly key: Buffer

  constructor(key: string) {
    this.key = parseDataKey(key)
  }

  encrypt(value: string) {
    const nonce = randomBytes(12)
    const cipher = createCipheriv('aes-256-gcm', this.key, nonce)
    const ciphertext = Buffer.concat([
      cipher.update(value, 'utf8'),
      cipher.final(),
    ])
    const tag = cipher.getAuthTag()
    return [
      ENVELOPE_VERSION,
      nonce.toString('base64url'),
      tag.toString('base64url'),
      ciphertext.toString('base64url'),
    ].join('.')
  }

  decrypt(envelope: string) {
    const [version, nonceValue, tagValue, ciphertextValue] = envelope.split('.')
    if (
      version !== ENVELOPE_VERSION ||
      !nonceValue ||
      !tagValue ||
      !ciphertextValue
    ) {
      throw new Error('Unsupported encrypted data envelope')
    }
    const decipher = createDecipheriv(
      'aes-256-gcm',
      this.key,
      Buffer.from(nonceValue, 'base64url'),
    )
    decipher.setAuthTag(Buffer.from(tagValue, 'base64url'))
    return Buffer.concat([
      decipher.update(Buffer.from(ciphertextValue, 'base64url')),
      decipher.final(),
    ]).toString('utf8')
  }
}
