import { describe, expect, it } from 'vitest'

import { CompanionCredentialService } from '~/modules/companion/companion-credential.service'

describe('CompanionCredentialService', () => {
  const service = new CompanionCredentialService()

  it('accepts human-friendly pairing code formatting while hashing only the canonical secret', () => {
    const credential = service.createPairingCredential()

    expect(credential.displayCode).toMatch(
      /^[\dA-HJKMNP-TV-Z]{5}-[\dA-HJKMNP-TV-Z]{5}$/,
    )
    expect(credential.codeHash).toMatch(/^[\da-f]{64}$/)
    expect(credential.codeHash).not.toContain(credential.displayCode)
    expect(service.hashPairingCode(credential.displayCode)).toBe(
      credential.codeHash,
    )
    expect(service.hashPairingCode(credential.displayCode.toLowerCase())).toBe(
      credential.codeHash,
    )
    expect(
      service.hashPairingCode(credential.displayCode.replace('-', ' ')),
    ).toBe(credential.codeHash)
  })

  it('binds an opaque device token to its public device ID and verifies its hash in constant time', () => {
    const credential = service.createDeviceCredential()

    expect(service.deviceIdFromToken(credential.token)).toBe(
      credential.deviceId,
    )
    expect(
      service.verifyDeviceToken(credential.token, credential.tokenHash),
    ).toBe(true)

    const replacement = credential.token.endsWith('A') ? 'B' : 'A'
    const tampered = `${credential.token.slice(0, -1)}${replacement}`
    expect(service.verifyDeviceToken(tampered, credential.tokenHash)).toBe(
      false,
    )
    expect(service.deviceIdFromToken('not-a-device-token')).toBeNull()
  })
})
