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

const currentRedis = () => parseRedisUrl(process.env.REDIS_CONNECTION_STRING)

export const PORT = process.env.PORT || 2333
export const API_VERSION = 3
export const DEMO_MODE = false

export const CROSS_DOMAIN = {
  allowedOrigins: process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',')
    : ['localhost:*', '127.0.0.1'],
}

// REDIS likewise read lazily so testcontainer-driven URIs win over the
// defaults that core-app-config froze on first import.
export const REDIS = {
  get host(): string {
    return currentRedis()?.host || process.env.REDIS_HOST || '127.0.0.1'
  },
  get port(): number {
    return currentRedis()?.port || Number(process.env.REDIS_PORT || 6379)
  },
  get username(): string | undefined {
    return currentRedis()?.username
  },
  get password(): string | null {
    return currentRedis()?.password ?? process.env.REDIS_PASSWORD ?? null
  },
  get db(): number | undefined {
    return currentRedis()?.db
  },
  get url(): string | undefined {
    return currentRedis()?.url
  },
  get tls(): boolean {
    return currentRedis()?.tls ?? false
  },
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

// Dynamic getters so seedProcessEnv (called inside createE2EBackend AFTER
// this module is loaded) can still influence the Pool's connection params.
// A frozen object literal would lock in defaults (127.0.0.1:5432) before
// the testcontainer URI is known.
export const POSTGRES = {
  get connectionString(): string | undefined {
    return process.env.PG_URL || process.env.PG_CONNECTION_STRING || undefined
  },
  get host(): string {
    return process.env.PG_HOST || '127.0.0.1'
  },
  get port(): number {
    return Number(process.env.PG_PORT || 5432)
  },
  get user(): string {
    return process.env.PG_USER || 'mx'
  },
  get password(): string {
    return process.env.PG_PASSWORD || 'mx'
  },
  get database(): string {
    return process.env.PG_DATABASE || 'mx_core_test'
  },
  get maxPoolSize(): number {
    return Number(process.env.PG_MAX_POOL_SIZE || 5)
  },
  get ssl(): false | { rejectUnauthorized: boolean } {
    return parseBoolean(process.env.PG_SSL)
      ? { rejectUnauthorized: false }
      : false
  },
}

export const ADMIN_UPDATE = {
  s3BaseUrl:
    process.env.ADMIN_UPDATE_S3_BASE_URL || 'https://admin-r2.innei.dev',
}
