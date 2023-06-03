import crypto from 'crypto'

import { ENCRYPT } from '~/app.config'

const SALT = 'mx-encrypt-salt'

/**
 * NOTE: this function created by ChatGPT
 */
export const mapString = (keyString: string) => {
  if (!ENCRYPT.enable) return keyString
  if (keyString.length === 64) return keyString
  if (keyString.length > 64) {
    throw new Error('keyString length must less than 64')
  }

  if (!keyString) {
    throw new Error('keyString must not be empty')
  }

  const hash = crypto.createHash('sha256')
  hash.update(keyString + SALT)
  const digest = hash.digest('hex')
  if (digest.length >= 64) {
    return digest.slice(0, 64) // 如果哈希值的长度大于等于 64，直接返回哈希值
  } else {
    const padding = '0'.repeat(64 - digest.length) // 使用 0 填充到 64 位
    return padding + digest
  }
}

export class EncryptUtil {
  private static encryptStringPadding = '$${mx}$$'
  private static key = Buffer.from(mapString(ENCRYPT.key), 'hex')
  private static algorithm = ENCRYPT.algorithm || 'aes-256-ecb'

  public static encrypt(data: string): string {
    if (!ENCRYPT.enable) {
      return data
    }
    if (EncryptUtil.isEncryptedString(data)) {
      return data
    }

    const clearEncoding = 'utf8'
    const cipherEncoding = 'base64'
    const cipherChunks: string[] = []

    const cipher = crypto.createCipheriv(
      EncryptUtil.algorithm,
      EncryptUtil.key,
      '',
    )
    cipher.setAutoPadding(true)
    cipherChunks.push(cipher.update(data, clearEncoding, cipherEncoding))
    cipherChunks.push(cipher.final(cipherEncoding))
    return EncryptUtil.encryptStringPadding + cipherChunks.join('')
  }

  public static isEncryptedString(data: string) {
    return data.startsWith(EncryptUtil.encryptStringPadding)
  }

  public static decrypt(data: string): string {
    if (!ENCRYPT.enable) {
      return data
    }

    if (!data) {
      return ''
    }

    if (!EncryptUtil.isEncryptedString(data)) {
      return data
    }

    const clearEncoding = 'utf8'
    const cipherEncoding = 'base64'
    const cipherChunks: string[] = []
    const decipher = crypto.createDecipheriv(
      EncryptUtil.algorithm,
      EncryptUtil.key,
      '',
    )
    decipher.setAutoPadding(true)
    cipherChunks.push(
      decipher.update(
        data.slice(EncryptUtil.encryptStringPadding.length),
        cipherEncoding,
        clearEncoding,
      ),
    )
    cipherChunks.push(decipher.final(clearEncoding))
    return cipherChunks.join('')
  }
}
