import { randomUUID } from 'node:crypto'

import { Injectable } from '@nestjs/common'

import { RedisService } from '~/processors/redis/redis.service'

const LOCK_TTL_MS = 90_000
const LOCK_KEY_PREFIX = 'ai-agent:lock:session:'

@Injectable()
export class AIAgentSessionLockService {
  constructor(private readonly redisService: RedisService) {}

  async acquire(sessionId: string, ttlMs: number = LOCK_TTL_MS) {
    const redis = this.redisService.getClient()
    const token = randomUUID()
    const key = this.getKey(sessionId)

    const result = await redis.set(key, token, 'PX', ttlMs, 'NX')
    if (result !== 'OK') {
      return null
    }

    return {
      key,
      token,
    }
  }

  async renew(sessionId: string, token: string, ttlMs: number = LOCK_TTL_MS) {
    const redis = this.redisService.getClient()
    const key = this.getKey(sessionId)

    const script = `
if redis.call('GET', KEYS[1]) == ARGV[1] then
  return redis.call('PEXPIRE', KEYS[1], ARGV[2])
end
return 0
`

    const renewed = await redis.eval(script, 1, key, token, String(ttlMs))
    return renewed === 1
  }

  async release(sessionId: string, token: string) {
    const redis = this.redisService.getClient()
    const key = this.getKey(sessionId)

    const script = `
if redis.call('GET', KEYS[1]) == ARGV[1] then
  return redis.call('DEL', KEYS[1])
end
return 0
`

    await redis.eval(script, 1, key, token)
  }

  private getKey(sessionId: string) {
    return `${LOCK_KEY_PREFIX}${sessionId}`
  }
}
