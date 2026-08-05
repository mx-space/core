import type IORedis from 'ioredis'

const LOCK_TTL_SEC = 300
const LOCK_RENEW_INTERVAL_MS = 120_000

export function ttsLangLockKey(refId: string, lang: string): string {
  return `ai:tts:lock:${refId}:${lang}`
}

export async function withTtsLangLock<T>(
  redis: IORedis,
  refId: string,
  lang: string,
  fn: () => Promise<T>,
): Promise<T | null> {
  const key = ttsLangLockKey(refId, lang)
  const token = `${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
  const acquired = await redis.set(key, token, 'EX', LOCK_TTL_SEC, 'NX')
  if (!acquired) return null

  const renew = setInterval(() => {
    void redis.expire(key, LOCK_TTL_SEC)
  }, LOCK_RENEW_INTERVAL_MS)

  try {
    return await fn()
  } finally {
    clearInterval(renew)
    const current = await redis.get(key)
    if (current === token) await redis.del(key)
  }
}
