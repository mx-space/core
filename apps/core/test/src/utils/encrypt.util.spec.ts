import crypto from 'node:crypto'

import { ENCRYPT } from '~/app.config'
import { EncryptUtil, mapString } from '~/utils/encrypt.util'

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

  it('never silently writes plaintext or returns ciphertext when encryption is disabled', () => {
    const encrypted = EncryptUtil.encrypt('secret')
    const enabled = ENCRYPT.enable
    ENCRYPT.enable = false
    try {
      expect(() => EncryptUtil.encrypt('secret')).toThrow()
      expect(() => EncryptUtil.decrypt(encrypted)).toThrow()
      expect(EncryptUtil.encrypt('')).toBe('')
      expect(EncryptUtil.decrypt('legacy-plaintext')).toBe('legacy-plaintext')
    } finally {
      ENCRYPT.enable = enabled
    }
  })

  it('keeps the legacy key mapping readable', () => {
    expect(mapString('1234567890')).toBe(
      '3b5aa8094f9d741d2a5cb7e8120f92aad4916df6beafe1be0008a2add070f523',
    )
    expect(mapString('1'.repeat(64))).toBe('1'.repeat(64))
    expect(() => mapString('')).toThrow()
    expect(() => mapString('1'.repeat(65))).toThrow()
  })
})
