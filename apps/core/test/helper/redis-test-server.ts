import { existsSync } from 'node:fs'
import { createServer } from 'node:net'

import RedisMemoryServer from 'redis-memory-server'
import type { RedisMemoryServerOptsT } from 'redis-memory-server/lib/RedisMemoryServer'

export function findRedisSystemBinary(): string | undefined {
  return [
    process.env.REDIS_BINARY_PATH,
    '/opt/homebrew/bin/redis-server',
    '/usr/local/bin/redis-server',
    '/usr/bin/redis-server',
    '/usr/sbin/redis-server',
    '/run/current-system/sw/bin/redis-server',
  ].find((path) => path && existsSync(path))
}

async function findFreePort(host: string): Promise<number> {
  const reservation = createServer()
  return new Promise((resolve, reject) => {
    reservation.once('error', reject)
    reservation.listen({ host, port: 0 }, () => {
      const address = reservation.address()
      if (!address || typeof address === 'string') {
        reservation.close()
        reject(new Error('Expected a TCP address for test Redis'))
        return
      }
      reservation.close((error) =>
        error ? reject(error) : resolve(address.port),
      )
    })
  })
}

export async function startTestRedis(
  options: RedisMemoryServerOptsT = {},
  createServer = (opts: RedisMemoryServerOptsT) => new RedisMemoryServer(opts),
): Promise<RedisMemoryServer> {
  for (let attempt = 0; ; attempt++) {
    // The library probes an unspecified address but Redis binds to IPv4.
    // On macOS an IPv6 probe can accept a port already occupied on IPv4.
    const ip = options.instance?.ip ?? '127.0.0.1'
    const port = options.instance?.port ?? (await findFreePort(ip))
    const server = createServer({
      ...options,
      instance: { ...options.instance, ip, port },
      autoStart: false,
    })
    try {
      await server.start()
      return server
    } catch (error) {
      // get-port releases its reservation before redis-server binds. Another
      // worker can take it in that gap. The failed child exits on a bind error;
      // a fresh server selects a new port instead of reusing the rejected start.
      const message = error instanceof Error ? error.message : String(error)
      if (attempt >= 2 || !/^Port \d+ already in use$/.test(message))
        throw error
    }
  }
}
