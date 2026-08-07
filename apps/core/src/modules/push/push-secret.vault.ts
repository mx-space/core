import crypto from 'node:crypto'

import { ENCRYPT } from '~/app.config'
import { mapString } from '~/utils/encrypt.util'

const PREFIX = '$${push}$$v1.'

export class PushSecretVault {
  static assertConfigured() {
    if (!ENCRYPT.enable || !ENCRYPT.key) {
      throw new Error(
        'Push notifications require MX_ENCRYPT_KEY so source credentials are never stored in plaintext',
      )
    }
  }

  static encrypt(value: string) {
    PushSecretVault.assertConfigured()
    const nonce = crypto.randomBytes(12)
    const cipher = crypto.createCipheriv(
      'aes-256-gcm',
      Buffer.from(mapString(ENCRYPT.key), 'hex'),
      nonce,
    )
    const ciphertext = Buffer.concat([
      cipher.update(value, 'utf8'),
      cipher.final(),
    ])
    return `${PREFIX}${nonce.toString('base64url')}.${cipher
      .getAuthTag()
      .toString('base64url')}.${ciphertext.toString('base64url')}`
  }

  static decrypt(value: string) {
    PushSecretVault.assertConfigured()
    if (!value.startsWith(PREFIX)) {
      throw new Error(
        'Push source credential is not stored in a supported encrypted envelope',
      )
    }
    const [nonceValue, tagValue, ciphertextValue] = value
      .slice(PREFIX.length)
      .split('.')
    if (!nonceValue || !tagValue || !ciphertextValue) {
      throw new Error('Push source credential envelope is malformed')
    }
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      Buffer.from(mapString(ENCRYPT.key), 'hex'),
      Buffer.from(nonceValue, 'base64url'),
    )
    decipher.setAuthTag(Buffer.from(tagValue, 'base64url'))
    return Buffer.concat([
      decipher.update(Buffer.from(ciphertextValue, 'base64url')),
      decipher.final(),
    ]).toString('utf8')
  }
}
