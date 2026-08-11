import { describe, expect, it } from 'vitest'

import {
  parseRedisConnectionString,
  resolveRedisConnectionStringEnv,
} from '~/utils/redis-config.util'

describe('redis config utilities', () => {
  it('accepts the provider-standard REDIS_URL alias', () => {
    expect(
      resolveRedisConnectionStringEnv({
        REDIS_URL: 'rediss://default:secret@redis.example.com:6380',
      }),
    ).toBe('rediss://default:secret@redis.example.com:6380')
  })

  it('prefers the canonical connection string over aliases', () => {
    expect(
      resolveRedisConnectionStringEnv({
        REDIS_CONNECTION_STRING: 'redis://canonical:6379',
        REDIS_CONNECTION: 'redis://legacy:6379',
        REDIS_URL: 'rediss://provider:6380',
      }),
    ).toBe('redis://canonical:6379')
  })

  it('parses rediss URLs as TLS connections without retaining credentials in the URL', () => {
    const encodedAuth = ['default', ['sample', '%40', 'value'].join('')].join(
      ':',
    )
    const decodedAuth = ['sample', '@', 'value'].join('')

    expect(
      parseRedisConnectionString(
        `rediss://${encodedAuth}@redis.example.com:6380/2`,
      ),
    ).toEqual({
      url: 'rediss://redis.example.com:6380/2',
      host: 'redis.example.com',
      port: 6380,
      username: 'default',
      password: decodedAuth,
      db: 2,
      tls: true,
    })
  })

  it('rejects non-Redis URL protocols', () => {
    expect(() =>
      parseRedisConnectionString('https://redis.example.com'),
    ).toThrow('Invalid redis connection string protocol: https:')
  })
})
