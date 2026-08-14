import { importPKCS8, SignJWT } from 'jose'

export const APPLE_ORIGIN = 'https://appleid.apple.com'

const CLIENT_SECRET_TTL_SECONDS = 180 * 24 * 60 * 60

export interface AppleClientSecretInput {
  clientId: string
  keyId: string
  privateKey: string
  teamId: string
}

export function normalizeApplePrivateKey(privateKey: string) {
  return privateKey.replaceAll(String.raw`\n`, '\n').trim()
}

export async function signAppleClientSecret({
  clientId,
  keyId,
  privateKey,
  teamId,
}: AppleClientSecretInput) {
  const key = await importPKCS8(normalizeApplePrivateKey(privateKey), 'ES256')
  const now = Math.floor(Date.now() / 1000)

  return new SignJWT({})
    .setProtectedHeader({ alg: 'ES256', kid: keyId })
    .setIssuer(teamId)
    .setSubject(clientId)
    .setAudience(APPLE_ORIGIN)
    .setIssuedAt(now)
    .setExpirationTime(now + CLIENT_SECRET_TTL_SECONDS)
    .sign(key)
}
