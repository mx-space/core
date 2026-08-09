import { describe, expect, it } from 'vitest'

import { PushSecretVault } from '~/modules/push/push-secret.vault'

describe('PushSecretVault', () => {
  it('uses an authenticated envelope and rejects tampering', () => {
    const encrypted = PushSecretVault.encrypt('srcsec_private')
    expect(encrypted).toMatch(/^\$\$\{push\}\$\$v1\./)
    expect(encrypted).not.toContain('srcsec_private')
    expect(PushSecretVault.decrypt(encrypted)).toBe('srcsec_private')
    // Flipping the trailing base64url character can land on padding bits that
    // decode away, leaving the ciphertext bytes — and the GCM tag — unchanged.
    const ciphertext = Buffer.from(encrypted.split('.').pop()!, 'base64url')
    ciphertext[0] ^= 0xff
    const tampered = encrypted.replace(
      /[^.]+$/,
      ciphertext.toString('base64url'),
    )
    expect(tampered).not.toBe(encrypted)
    expect(() => PushSecretVault.decrypt(tampered)).toThrow()
  })
})
