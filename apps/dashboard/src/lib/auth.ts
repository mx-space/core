import { getStorageNS } from './ns'

const CANDIDATE_TOKEN_KEYS = [
  'token',
  getStorageNS('token'),
  'auth:token',
  getStorageNS('auth:token'),
]

export function getAuthToken(): string | null {
  try {
    for (const key of CANDIDATE_TOKEN_KEYS) {
      const value = localStorage.getItem(key)
      if (value) return value
    }
  } catch {
    // ignore storage access errors (e.g., SSR or privacy mode)
  }
  return null
}

export function setAuthToken(token: string) {
  try {
    localStorage.setItem(getStorageNS('token'), token)
  } catch {
    // ignore storage write errors
  }
}

export function getSocketAuth(): { token?: string } {
  const token = getAuthToken()
  if (!token) return {}
  const normalized =
    token.startsWith('bearer ') || token.startsWith('Bearer ')
      ? token
      : `bearer ${token}`
  return { token: normalized }
}
