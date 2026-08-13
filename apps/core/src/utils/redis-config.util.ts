const REDIS_CONNECTION_ENV_KEYS = [
  'REDIS_CONNECTION_STRING',
  'REDIS_CONNECTION',
  'REDIS_URL',
] as const

type RedisConnectionEnv = Partial<
  Record<(typeof REDIS_CONNECTION_ENV_KEYS)[number], string>
>

export function resolveRedisConnectionStringEnv(
  env: RedisConnectionEnv = process.env,
) {
  for (const key of REDIS_CONNECTION_ENV_KEYS) {
    const value = env[key]?.trim()
    if (value) return value
  }

  return undefined
}

export function parseRedisConnectionString(input: string) {
  const raw = String(input).trim()
  if (!raw) return null

  const withProtocol =
    raw.includes('://') || raw.startsWith('redis:') || raw.startsWith('rediss:')
      ? raw
      : `redis://${raw}`

  const url = new URL(withProtocol)

  if (url.protocol !== 'redis:' && url.protocol !== 'rediss:') {
    throw new Error(`Invalid redis connection string protocol: ${url.protocol}`)
  }

  const host = url.hostname
  const port = url.port ? Number(url.port) : undefined
  const username = url.username ? decodeURIComponent(url.username) : undefined
  const password = url.password ? decodeURIComponent(url.password) : undefined

  const dbFromPath = url.pathname?.replace(/^\//, '')
  const db =
    dbFromPath && /^\d+$/.test(dbFromPath) ? Number(dbFromPath) : undefined

  // Keep credentials out of the URL passed downstream and provide them as
  // explicit client options instead.
  const origin =
    url.port && url.port.length > 0
      ? `${url.protocol}//${url.hostname}:${url.port}`
      : `${url.protocol}//${url.hostname}`
  const sanitizedUrl = `${origin}${url.pathname || ''}${url.search || ''}`

  return {
    url: sanitizedUrl,
    host,
    port,
    username,
    password,
    db,
    tls: url.protocol === 'rediss:',
  }
}
