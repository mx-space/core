import type IORedis from 'ioredis'

const LOCK_TTL_SEC = 300
const LOCK_RENEW_INTERVAL_MS = 120_000

// Both scripts compare-and-swap on the token: a bare EXPIRE/DEL would extend or
// release a *different* holder's lock if ours expired between the read and the
// write.
const RENEW_SCRIPT = `if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('expire', KEYS[1], ARGV[2]) else return 0 end`
const RELEASE_SCRIPT = `if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end`

export function ttsLangLockKey(refId: string, lang: string): string {
  return `ai:tts:lock:${refId}:${lang}`
}

export async function withTtsLangLock<T>(
  redis: IORedis,
  refId: string,
  lang: string,
  fn: () => Promise<T>,
  onRenewError?: (error: Error) => void,
): Promise<T | null> {
  const key = ttsLangLockKey(refId, lang)
  const token = `${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
  const acquired = await redis.set(key, token, 'EX', LOCK_TTL_SEC, 'NX')
  if (!acquired) return null

  const renew = setInterval(() => {
    redis
      .eval(RENEW_SCRIPT, 1, key, token, String(LOCK_TTL_SEC))
      .catch((error: Error) => onRenewError?.(error))
  }, LOCK_RENEW_INTERVAL_MS)

  try {
    return await fn()
  } finally {
    clearInterval(renew)
    await redis.eval(RELEASE_SCRIPT, 1, key, token)
  }
}
