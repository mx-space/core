import { createServer } from 'node:net'

import IORedis from 'ioredis'
import RedisMemoryServer from 'redis-memory-server'
import { describe, expect, it, vi } from 'vitest'

import { findRedisSystemBinary, startTestRedis } from './redis-test-server'

describe('test Redis startup', () => {
  it.each([
    { conflicts: 1, outcome: 'recovers from a transient port conflict' },
    {
      conflicts: 3,
      outcome: 'rejects persistent port conflicts after bounded retries',
    },
  ])('$outcome', async ({ conflicts }) => {
    const occupied = createServer()
    await new Promise<void>((resolve) =>
      occupied.listen(0, '127.0.0.1', resolve),
    )
    const address = occupied.address()
    if (!address || typeof address === 'string')
      throw new Error('Expected TCP port')
    const systemBinary = findRedisSystemBinary()
    let attempt = 0
    const create = vi.fn(
      (options) =>
        new RedisMemoryServer({
          ...options,
          // Force the port conflicts before allowing a real Redis launch.
          instance: {
            ...options.instance,
            args: attempt++ < conflicts ? ['--port', String(address.port)] : [],
          },
        }),
    )
    let server: RedisMemoryServer | undefined
    let client: IORedis | undefined
    try {
      const starting = startTestRedis(
        { binary: systemBinary ? { systemBinary } : undefined },
        create,
      )
      if (conflicts === 3) {
        await expect(starting).rejects.toMatch(/^Port \d+ already in use$/)
        expect(create).toHaveBeenCalledTimes(3)
        expect(occupied.listening).toBe(true)
        return
      }
      server = await starting
      client = new IORedis(await server.getPort(), await server.getHost())
      expect(await client.ping()).toBe('PONG')
      expect(await server.getPort()).not.toBe(address.port)
    } finally {
      await client?.quit()
      await server?.stop()
      await new Promise<void>((resolve, reject) =>
        occupied.close((error) => (error ? reject(error) : resolve())),
      )
    }
  })

  it('does not retry invalid server configuration', async () => {
    const create = vi.fn((options) => new RedisMemoryServer(options))
    const systemBinary = findRedisSystemBinary()
    await expect(
      startTestRedis(
        {
          binary: systemBinary ? { systemBinary } : undefined,
          instance: { args: ['--mx-invalid-test-option'] },
        },
        create,
      ),
    ).rejects.toMatch(/redis-server instance closed with code "1"/)
    expect(create).toHaveBeenCalledTimes(1)
  })
})
