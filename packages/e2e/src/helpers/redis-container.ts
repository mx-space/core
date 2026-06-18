import { GenericContainer } from 'testcontainers'

export interface RedisTestContainer {
  uri: string
  host: string
  port: number
  stop: () => Promise<void>
}

/**
 * Always allocate a dedicated Redis instance per backend. ConfigsService caches
 * the merged config under a fixed `mx:config:cache` key; sharing a single Redis
 * across vitest workers lets one backend's `configInit` overwrite another's
 * `patchAndValid` write, which surfaced as config-rw flakiness in CI where the
 * REDIS_VERIFY_URL service container was shared. The per-worker testcontainer
 * uses a dynamically mapped port so it does not conflict with the CI service
 * container Redis that still listens on 6379.
 */
export async function startRedisTestContainer(): Promise<RedisTestContainer> {
  const container = await new GenericContainer('redis:7-alpine')
    .withExposedPorts(6379)
    .start()

  const host = container.getHost()
  const port = container.getMappedPort(6379)

  return {
    uri: `redis://${host}:${port}`,
    host,
    port,
    stop: () => container.stop().then(() => undefined),
  }
}
