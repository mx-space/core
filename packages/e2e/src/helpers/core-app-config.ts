// Aliased onto `~/app.config` from vitest config — production reads YAML from
// `~/.config/mx-server`, which isn't available under CI; this mirror is
// env-driven so PG/Redis URIs from seedProcessEnv land in the right places.

type AxiosRequestConfig = {
  timeout: number
}

const parseBoolean = (value: unknown): boolean | undefined => {
  if (typeof value === 'boolean') return value
  if (typeof value !== 'string') return undefined
  const normalized = value.trim().toLowerCase()
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false
  return undefined
}

const parseRedisUrl = (input: string | undefined) => {
  if (!input) return null
  const url = new URL(input)
  return {
    url: input,
    host: url.hostname,
    port: url.port ? Number(url.port) : 6379,
    username: url.username ? decodeURIComponent(url.username) : undefined,
    password: url.password ? decodeURIComponent(url.password) : null,
    db: url.pathname?.replace(/^\//, '')
      ? Number(url.pathname.replace(/^\//, ''))
      : undefined,
    tls: url.protocol === 'rediss:',
  }
}

const redis = parseRedisUrl(process.env.REDIS_CONNECTION_STRING)

export const PORT = process.env.PORT || 2333
export const API_VERSION = 3
export const DEMO_MODE = false

export const CROSS_DOMAIN = {
  allowedOrigins: process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',')
    : ['localhost:*', '127.0.0.1'],
}

export const REDIS = {
  host: redis?.host || process.env.REDIS_HOST || '127.0.0.1',
  port: redis?.port || Number(process.env.REDIS_PORT || 6379),
  username: redis?.username,
  password: redis?.password ?? process.env.REDIS_PASSWORD ?? null,
  db: redis?.db,
  url: redis?.url,
  tls: redis?.tls ?? false,
  ttl: null,
  max: 20,
  disableApiCache: false,
}

export const HTTP_CACHE = {
  ttl: 15,
  enableCDNHeader: false,
  enableForceCacheHeader: false,
}

export const AXIOS_CONFIG: AxiosRequestConfig = {
  timeout: 10_000,
}

export const SECURITY = {
  jwtSecret: process.env.JWT_SECRET || 'e2e-jwt-secret-e2e-jwt-secret-123456',
  jwtExpire: Number(process.env.JWT_EXPIRE) || 14,
}

export const CLUSTER = {
  enable: false,
  workers: undefined,
}

export const DEBUG_MODE = {
  logging: false,
  httpRequestVerbose: false,
  memoryDump: false,
}

export const ENCRYPT = {
  key:
    process.env.MX_ENCRYPT_KEY ||
    '593f62860255feb0a914534a43814b9809cc7534da7f5485cd2e3d3c8609acab',
  enable: true,
  algorithm: 'aes-256-ecb',
}

export const TELEMETRY = {
  enable: false,
}

export const THROTTLE_OPTIONS = {
  ttl: 10_000,
  limit: 10_000,
}

export const SNOWFLAKE = {
  workerId: Number(process.env.SNOWFLAKE_WORKER_ID ?? 1),
  epochMs: 1746144000000,
}

export const POSTGRES = {
  connectionString: process.env.PG_URL || process.env.PG_CONNECTION_STRING,
  host: process.env.PG_HOST || '127.0.0.1',
  port: Number(process.env.PG_PORT || 5432),
  user: process.env.PG_USER || 'mx',
  password: process.env.PG_PASSWORD || 'mx',
  database: process.env.PG_DATABASE || 'mx_core_test',
  maxPoolSize: Number(process.env.PG_MAX_POOL_SIZE || 5),
  ssl: parseBoolean(process.env.PG_SSL) ? { rejectUnauthorized: false } : false,
}

export const ADMIN_UPDATE = {
  s3BaseUrl:
    process.env.ADMIN_UPDATE_S3_BASE_URL || 'https://admin-r2.innei.dev',
}
