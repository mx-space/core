import {
  createHmac,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from 'node:crypto'

import { Injectable } from '@nestjs/common'

import { ENCRYPT, SECURITY } from '~/app.config'

const PAIRING_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'
const PAIRING_CODE_LENGTH = 10
const DEVICE_TOKEN_PATTERN =
  /^yhc_([\da-f]{8}-[\da-f]{4}-[1-5][\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12})\.[\w-]{43}$/i
const SHA_256_HEX_PATTERN = /^[\da-f]{64}$/

@Injectable()
export class CompanionCredentialService {
  // Production deployments already share SECURITY.jwtSecret across replicas
  // for Better Auth. ENCRYPT.key remains the local-development fallback.
  private readonly pepper = SECURITY.jwtSecret || ENCRYPT.key

  createPairingCredential() {
    const bytes = randomBytes(PAIRING_CODE_LENGTH)
    let canonicalCode = ''
    for (const byte of bytes) {
      canonicalCode += PAIRING_ALPHABET[byte % PAIRING_ALPHABET.length]
    }
    const displayCode = `${canonicalCode.slice(0, 5)}-${canonicalCode.slice(5)}`
    return {
      displayCode,
      codeHash: this.hash('pairing-code', canonicalCode),
    }
  }

  hashPairingCode(input: string): string | null {
    const canonicalCode = this.normalizePairingCode(input)
    if (!canonicalCode) return null
    return this.hash('pairing-code', canonicalCode)
  }

  createDeviceCredential() {
    const deviceId = randomUUID()
    const secret = randomBytes(32).toString('base64url')
    const token = `yhc_${deviceId}.${secret}`
    return {
      deviceId,
      token,
      tokenHash: this.hash('device-token', token),
    }
  }

  deviceIdFromToken(token: string): string | null {
    return DEVICE_TOKEN_PATTERN.exec(token)?.[1]?.toLowerCase() ?? null
  }

  verifyDeviceToken(token: string, storedHash: string): boolean {
    if (!SHA_256_HEX_PATTERN.test(storedHash)) return false
    const actual = Buffer.from(this.hash('device-token', token), 'hex')
    const expected = Buffer.from(storedHash, 'hex')
    return (
      actual.length === expected.length && timingSafeEqual(actual, expected)
    )
  }

  private normalizePairingCode(input: string): string | null {
    const canonicalCode = input.toUpperCase().replaceAll(/[\s-]/g, '')
    if (canonicalCode.length !== PAIRING_CODE_LENGTH) return null
    for (const character of canonicalCode) {
      if (!PAIRING_ALPHABET.includes(character)) return null
    }
    return canonicalCode
  }

  private hash(domain: 'pairing-code' | 'device-token', value: string) {
    return createHmac('sha256', this.pepper)
      .update(`yohaku-companion:${domain}\0`, 'utf8')
      .update(value, 'utf8')
      .digest('hex')
  }
}
