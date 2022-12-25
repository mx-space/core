import crypto from 'crypto'

import { ENCRYPT } from '~/app.config'

export class EncryptUtil {
  private static encryptStringPadding = '$${mx}$$'
  private static key = Buffer.from(ENCRYPT.key, 'hex')

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

    const cipher = crypto.createCipheriv('aes-256-ecb', EncryptUtil.key, '')
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
    const decipher = crypto.createDecipheriv('aes-256-ecb', EncryptUtil.key, '')
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
