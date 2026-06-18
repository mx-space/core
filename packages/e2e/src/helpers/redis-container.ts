import { GenericContainer } from 'testcontainers'

export interface RedisTestContainer {
  uri: string
  host: string
  port: number
  stop: () => Promise<void>
}

export async function startRedisTestContainer(): Promise<RedisTestContainer> {
  const external = process.env.REDIS_VERIFY_URL?.trim()
  if (external) {
    const url = new URL(external)
    return {
      uri: external,
      host: url.hostname,
      port: Number(url.port || 6379),
      stop: async () => {},
    }
  }

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
