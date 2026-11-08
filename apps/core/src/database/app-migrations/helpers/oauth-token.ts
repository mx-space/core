import { parseEnvelope, symmetricDecrypt } from 'better-auth/crypto'

export function oauthKey(secret: string) {
  return {
    currentVersion: 1,
    keys: new Map([[1, secret]]),
    legacySecret: secret,
  }
}

export function isEncryptedOAuth(token: string) {
  // Better Auth's legacy XChaCha20 payload: 24-byte nonce + 16-byte tag + text.
  return (
    token.startsWith('$ba$') ||
    (token.length >= 80 && /^[\da-f]+$/i.test(token))
  )
}

export async function unwrapOAuthToken(token: string, secret: string) {
  if (!isEncryptedOAuth(token)) return token
  if (token.startsWith('$ba$') && !parseEnvelope(token))
    throw new Error('Malformed OAuth envelope')
  return symmetricDecrypt({ key: oauthKey(secret), data: token })
}
