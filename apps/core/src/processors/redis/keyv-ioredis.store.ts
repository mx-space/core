import { EventEmitter } from 'node:events'

import type { RedisOptions } from 'ioredis'
import IORedis from 'ioredis'

import { REDIS } from '~/app.config'
import { API_CACHE_PREFIX } from '~/constants/cache.constant'

import { REDIS_CLIENT_OPTIONS } from './redis.service'

const SCAN_COUNT = 500

export class KeyvIoredisStore extends EventEmitter {
  readonly opts: Record<string, unknown> = {}
  namespace?: string

  private readonly client: IORedis

  constructor() {
    super()
    const sharedOptions: RedisOptions = {
      username: (REDIS as any).username,
      password: REDIS.password ?? undefined,
      db: (REDIS as any).db,
      ...(REDIS.tls ? { tls: {} } : {}),
      ...REDIS_CLIENT_OPTIONS,
    }

    this.client = REDIS.url
      ? new IORedis(REDIS.url, sharedOptions)
      : new IORedis({ host: REDIS.host, port: REDIS.port, ...sharedOptions })

    this.client.on('error', (error) => this.emit('error', error))
  }

  async get<Value>(key: string): Promise<Value | undefined> {
    return ((await this.client.get(key)) as Value | null) ?? undefined
  }

  async getMany<Value>(keys: string[]): Promise<Array<Value | undefined>> {
    if (keys.length === 0) return []
    const values = await this.client.mget(keys)
    return values.map((value) => (value as Value | null) ?? undefined)
  }

  async set(key: string, value: string, ttl?: number) {
    if (ttl) await this.client.set(key, value, 'PX', ttl)
    else await this.client.set(key, value)
  }

  async delete(key: string) {
    return (await this.client.unlink(key)) > 0
  }

  async deleteMany(keys: string[]) {
    if (keys.length === 0) return false
    return (await this.client.unlink(...keys)) > 0
  }

  async has(key: string) {
    return (await this.client.exists(key)) > 0
  }

  // Keys are written unprefixed (`useKeyPrefix: false`) so that
  // `RedisService.cleanCatch()` can still match them by `API_CACHE_PREFIX`.
  // The cache shares its database with live application data, so clear() is
  // scoped to that same prefix instead of the (unused) Keyv namespace.
  async clear() {
    let cursor = '0'
    do {
      const [next, keys] = await this.client.scan(
        cursor,
        'MATCH',
        `${API_CACHE_PREFIX}*`,
        'COUNT',
        SCAN_COUNT,
      )
      cursor = next
      if (keys.length > 0) await this.client.unlink(...keys)
    } while (cursor !== '0')
  }

  async disconnect() {
    await this.client.quit()
  }
}
