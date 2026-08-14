import { generateKeyPairSync } from 'node:crypto'

import { decodeJwt, decodeProtectedHeader, importSPKI, jwtVerify } from 'jose'

import {
  normalizeApplePrivateKey,
  signAppleClientSecret,
} from '~/modules/auth/apple-client-secret'

function createKeyPair() {
  const { privateKey, publicKey } = generateKeyPairSync('ec', {
    namedCurve: 'P-256',
  })
  return {
    privateKeyPem: privateKey.export({
      format: 'pem',
      type: 'pkcs8',
    }) as string,
    publicKeyPem: publicKey.export({ format: 'pem', type: 'spki' }) as string,
  }
}

describe('signAppleClientSecret', () => {
  it('signs a verifiable ES256 token with Apple claims', async () => {
    const { privateKeyPem, publicKeyPem } = createKeyPair()

    const token = await signAppleClientSecret({
      clientId: 'dev.innei.service',
      keyId: 'ABCD123456',
      privateKey: privateKeyPem,
      teamId: 'TEAM123456',
    })

    expect(decodeProtectedHeader(token)).toMatchObject({
      alg: 'ES256',
      kid: 'ABCD123456',
    })

    const { payload } = await jwtVerify(
      token,
      await importSPKI(publicKeyPem, 'ES256'),
    )
    expect(payload.iss).toBe('TEAM123456')
    expect(payload.sub).toBe('dev.innei.service')
    expect(payload.aud).toBe('https://appleid.apple.com')
  })

  it('expires within Apple six-month limit', async () => {
    const { privateKeyPem } = createKeyPair()

    const token = await signAppleClientSecret({
      clientId: 'dev.innei.service',
      keyId: 'ABCD123456',
      privateKey: privateKeyPem,
      teamId: 'TEAM123456',
    })

    const { exp, iat } = decodeJwt(token)
    expect(exp! - iat!).toBeLessThanOrEqual(15_777_000)
    expect(exp! - iat!).toBeGreaterThan(0)
  })

  it('accepts a private key whose newlines were escaped', async () => {
    const { privateKeyPem } = createKeyPair()
    const escaped = privateKeyPem.replaceAll('\n', String.raw`\n`)

    await expect(
      signAppleClientSecret({
        clientId: 'dev.innei.service',
        keyId: 'ABCD123456',
        privateKey: escaped,
        teamId: 'TEAM123456',
      }),
    ).resolves.toBeTypeOf('string')
  })
})

describe('normalizeApplePrivateKey', () => {
  it('restores escaped newlines and trims padding', () => {
    expect(normalizeApplePrivateKey(String.raw`  a\nb\nc  `)).toBe('a\nb\nc')
  })
})
