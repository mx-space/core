import type IORedis from 'ioredis'

const LOCK_TTL_MS = 120_000
const LOCK_RENEW_INTERVAL_MS = 40_000

const RENEW_SCRIPT = `if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('pexpire', KEYS[1], ARGV[2]) else return 0 end`
const RELEASE_SCRIPT = `if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end`

export type ReleaseRunLock = () => Promise<void>

export async function acquireConversationRunLock(
  redis: IORedis,
  conversationId: string,
  onLockError?: (error: Error, phase: 'renew' | 'release') => void,
): Promise<ReleaseRunLock | null> {
  const key = `ai:agent:run-lock:${conversationId}`
  const token = `${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
  const acquired = await redis.set(key, token, 'PX', LOCK_TTL_MS, 'NX')
  if (!acquired) return null

  const renew = setInterval(() => {
    redis
      .eval(RENEW_SCRIPT, 1, key, token, String(LOCK_TTL_MS))
      .catch((error: Error) => onLockError?.(error, 'renew'))
  }, LOCK_RENEW_INTERVAL_MS)

  return async () => {
    clearInterval(renew)
    await redis
      .eval(RELEASE_SCRIPT, 1, key, token)
      .then(() => undefined)
      .catch((error: Error) => onLockError?.(error, 'release'))
  }
}
