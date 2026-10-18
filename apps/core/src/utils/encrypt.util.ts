import crypto from 'node:crypto'

import { ENCRYPT, SECRET_STORAGE_V2 } from '~/app.config'

const PREFIX = '$${mx}$$'
const V2_PREFIX = `${PREFIX}v2.`

export const mapString = (key: string) => {
  if (!key || key.length > 64) throw new Error('Invalid encryption key length')
  return key.length === 64
    ? key
    : crypto.createHash('sha256').update(`${key}mx-encrypt-salt`).digest('hex')
}

export class EncryptUtil {
  static assertConfigured() {
    if (!ENCRYPT.enable || !/^[\da-f]{64}$/i.test(ENCRYPT.key)) {
      throw new Error(
        'Storing secrets requires a 64-character hexadecimal encryption key',
      )
    }
  }

  static isEncryptedString(value: string) {
    return value.startsWith(PREFIX)
  }

  static encrypt<T>(data: T, context = ''): T {
    if (typeof data === 'string') {
      if (!data) return data
      EncryptUtil.assertConfigured()
      let plain: string = data
      if (EncryptUtil.isEncryptedString(data)) {
        plain = EncryptUtil.decrypt(data, context)
        if (data.startsWith(V2_PREFIX) || !SECRET_STORAGE_V2) return data
      }
      if (!plain) return '' as T
      const key = Buffer.from(ENCRYPT.key, 'hex')
      if (!SECRET_STORAGE_V2) {
        const cipher = crypto.createCipheriv(
          ENCRYPT.algorithm || 'aes-256-ecb',
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
        EncryptUtil.encrypt(value, `${context}.${index}`),
      ) as T
    }
    if (data && typeof data === 'object') {
      return Object.fromEntries(
        Object.entries(data).map(([key, value]) => [
          key,
          EncryptUtil.encrypt(value, `${context}.${key}`),
        ]),
      ) as T
    }
    return data
  }

  static decrypt<T>(data: T, context = ''): T {
    if (typeof data === 'string') {
      if (!EncryptUtil.isEncryptedString(data)) return data
      EncryptUtil.assertConfigured()
      const key = Buffer.from(ENCRYPT.key, 'hex')
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
        ENCRYPT.algorithm || 'aes-256-ecb',
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
        EncryptUtil.decrypt(value, `${context}.${index}`),
      ) as T
    }
    if (data && typeof data === 'object') {
      return Object.fromEntries(
        Object.entries(data).map(([key, value]) => [
          key,
          EncryptUtil.decrypt(value, `${context}.${key}`),
        ]),
      ) as T
    }
    return data
  }
}
