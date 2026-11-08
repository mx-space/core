import crypto from 'node:crypto'

import { ENCRYPT } from '~/app.config'
import { EncryptUtil } from '~/utils/encrypt.util'
import { SecretCodec } from '~/utils/secret-codec'

const legacyEncrypt = (value: string) => {
  const cipher = crypto.createCipheriv(
    'aes-256-ecb',
    Buffer.from(ENCRYPT.key, 'hex'),
    '',
  )
  return (
    '$${mx}$$' +
    Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]).toString(
      'base64',
    )
  )
}

describe('EncryptUtil', () => {
  it('uses the fixed legacy reader and upgrades to interoperable AES-256-GCM despite obsolete codec options', () => {
    const options = {
      key: ENCRYPT.key,
      algorithm: 'aes-256-ctr',
    }
    const codec = new SecretCodec(options)
    const encrypted = codec.encrypt(
      legacyEncrypt('retained-secret'),
      'owner.field',
    )
    const [, keyId, nonce, tag, ciphertext] = encrypted.split('.')
    const key = Buffer.from(ENCRYPT.key, 'hex')
    const expectedId = crypto
      .createHash('sha256')
      .update(key)
      .digest('hex')
      .slice(0, 16)
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      key,
      Buffer.from(nonce, 'base64url'),
    )
    decipher.setAAD(Buffer.from(`mx:v2:${expectedId}:owner.field`))
    decipher.setAuthTag(Buffer.from(tag, 'base64url'))
    expect(keyId).toBe(expectedId)
    expect(
      Buffer.concat([
        decipher.update(Buffer.from(ciphertext, 'base64url')),
        decipher.final(),
      ]).toString('utf8'),
    ).toBe('retained-secret')
  })

  it('randomizes ciphertext and round-trips nested data', () => {
    const data = { value: ['a secret', null, 42] }
    const encrypted = EncryptUtil.encrypt(data)
    expect(encrypted).not.toEqual(data)
    expect(EncryptUtil.encrypt(data)).not.toEqual(encrypted)
    expect(EncryptUtil.decrypt(encrypted)).toEqual(data)
  })

  it('reads and upgrades legacy ECB data, including old encrypted empty values', () => {
    const legacy = legacyEncrypt('legacy-secret')
    expect(EncryptUtil.decrypt(legacy, 'config.field')).toBe('legacy-secret')
    const upgraded = EncryptUtil.encrypt(legacy, 'config.field')
    expect(upgraded.startsWith('$${mx}$$v2.')).toBe(true)
    expect(EncryptUtil.decrypt(upgraded, 'config.field')).toBe('legacy-secret')
    expect(EncryptUtil.encrypt(legacyEncrypt(''))).toBe('')
  })

  it('authenticates both ciphertext and its owning field', () => {
    const encrypted = EncryptUtil.encrypt('secret', 'config.owner.field')
    expect(() => EncryptUtil.decrypt(encrypted, 'config.other.field')).toThrow()
    const parts = encrypted.split('.')
    const bytes = Buffer.from(parts[4], 'base64url')
    bytes[0] ^= 0xff
    parts[4] = bytes.toString('base64url')
    expect(() =>
      EncryptUtil.decrypt(parts.join('.'), 'config.owner.field'),
    ).toThrow()
    expect(() => EncryptUtil.encrypt(encrypted, 'config.other.field')).toThrow()
    expect(EncryptUtil.encrypt(encrypted, 'config.owner.field')).toBe(encrypted)
  })

  it('rejects unsupported, malformed and wrong-key envelopes', () => {
    const encrypted = EncryptUtil.encrypt('secret')
    for (const invalid of [
      '$${mx}$$v3.x',
      '$${mx}$$v2.a.b.c',
      encrypted.replace(/v2\.[^.]+/, 'v2.0000000000000000'),
    ]) {
      expect(() => EncryptUtil.decrypt(invalid)).toThrow()
    }
  })

  it('rejects invalid keys for writes while preserving plaintext historical reads', () => {
    const encrypted = EncryptUtil.encrypt('secret')
    const key = ENCRYPT.key
    ENCRYPT.key = 'invalid-key'
    try {
      expect(() => EncryptUtil.encrypt('secret')).toThrow()
      expect(() => EncryptUtil.decrypt(encrypted)).toThrow()
      expect(EncryptUtil.encrypt('')).toBe('')
      expect(EncryptUtil.decrypt('legacy-plaintext')).toBe('legacy-plaintext')
    } finally {
      ENCRYPT.key = key
    }
  })
})
