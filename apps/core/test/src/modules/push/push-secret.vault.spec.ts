import { describe, expect, it } from 'vitest'

import { PushSecretVault } from '~/modules/push/push-secret.vault'

describe('PushSecretVault', () => {
  it('uses an authenticated envelope and rejects tampering', () => {
    const encrypted = PushSecretVault.encrypt('srcsec_private')
    expect(encrypted).toMatch(/^\$\$\{push\}\$\$v1\./)
    expect(encrypted).not.toContain('srcsec_private')
    expect(PushSecretVault.decrypt(encrypted)).toBe('srcsec_private')
    const replacement = encrypted.endsWith('x') ? 'y' : 'x'
    const tampered = `${encrypted.slice(0, -1)}${replacement}`
    expect(tampered).not.toBe(encrypted)
    expect(() => PushSecretVault.decrypt(tampered)).toThrow()
  })
})
