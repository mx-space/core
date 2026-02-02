import { readFileSync } from 'node:fs'
import https from 'node:https'
import path from 'node:path'
import { seconds } from '@nestjs/throttler'
import type { AxiosRequestConfig } from 'axios'
import { program } from 'commander'
import { load as yamlLoad } from 'js-yaml'
import nodeMachineId from 'node-machine-id'
import { isDebugMode, isDev } from './global/env.global'
import { parseBooleanishValue } from './utils/tool.util'

const { machineIdSync } = nodeMachineId

const {
  PORT: ENV_PORT,
  ALLOWED_ORIGINS,
  MX_ENCRYPT_KEY,
  MX_ENCRYPT_ENABLE,
  ENCRYPT_KEY: ENV_ENCRYPT_KEY,
  ENCRYPT_ENABLE: ENV_ENCRYPT_ENABLE,
  CDN_CACHE_HEADER,
  FORCE_CACHE_HEADER,
  MONGO_CONNECTION,
  THROTTLE_TTL,
  THROTTLE_LIMIT,
  JWT_SECRET,
  JWTSECRET,
  MX_DISABLE_TELEMETRY,
} = process.env

const ENV_JWT_SECRET = JWT_SECRET || JWTSECRET
const ENCRYPT_KEY_FROM_ENV = MX_ENCRYPT_KEY || ENV_ENCRYPT_KEY
const ENCRYPT_ENABLE_FROM_ENV = MX_ENCRYPT_ENABLE || ENV_ENCRYPT_ENABLE

function parseRedisConnectionString(input: string) {
  const raw = String(input).trim()
  if (!raw) return null

  const withProtocol =
    raw.includes('://') || raw.startsWith('redis:') || raw.startsWith('rediss:')
      ? raw
      : `redis://${raw}`

  const url = new URL(withProtocol)

  // `redis:` / `rediss:`
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

  // Build a sanitized URL (no auth) for downstream clients.
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

function applyArgvEnvFallback(argv: Record<string, any>) {
  // Fallback rule:
  // - If argv key is missing, fallback to env.
  // - env key = argv key uppercased (camelCase will be converted to SNAKE_CASE).
  //
  // NOTE: We only apply to commander-defined options to avoid accidentally
  // coercing unrelated config keys.
  for (const option of commander.options) {
    const optionKey = option.attributeName()
    const optionRawName = option.name() // usually snake_case from long flag, e.g. db_host
    const envKey = optionRawName.toUpperCase()

    // Do not override values from cli/config/default.
    if (argv[optionKey] !== undefined || argv[optionRawName] !== undefined) {
      continue
    }

    if (!(envKey in process.env)) continue
    const envVal = process.env[envKey]

    if (option.isBoolean()) {
      // Commander treats boolean env var as "present => true", but we want to support
      // explicit false like CLUSTER=false.
      const parsed = parseBooleanishValue(envVal)
      const value = parsed ?? true
      argv[optionKey] = value
      argv[optionRawName] = value
    } else {
      argv[optionKey] = envVal
      argv[optionRawName] = envVal
    }
  }
}

const commander = program
  .option('-p, --port <number>', 'server port', ENV_PORT)

  .option(
    '--allowed_origins <string>',
    'allowed origins, e.g. innei.ren,*.innei.ren',
    ALLOWED_ORIGINS,
  )
  .option('-c, --config <path>', 'load yaml config from file')
  .option('--demo', 'enable demo mode')

  // db
  .option('--collection_name <string>', 'mongodb collection name')
  .option('--db_host <string>', 'mongodb database host')
  .option('--db_port <number>', 'mongodb database port')
  .option('--db_user <string>', 'mongodb database user')
  .option('--db_password <string>', 'mongodb database password')
  .option('--db_options <string>', 'mongodb database options')
  .option(
    '--db_connection_string <string>',
    'mongodb connection string',
    MONGO_CONNECTION,
  )
  // redis
  .option('--redis_connection_string <string>', 'redis connection string')
  .option('--redis_host <string>', 'redis host')
  .option('--redis_port <number>', 'redis port')
  .option('--redis_password <string>', 'redis password')
  .option('--disable_cache', 'disable redis cache')

  // jwt
  .option('--jwt_secret <string>', 'custom jwt secret', ENV_JWT_SECRET)
  .option('--jwt_expire <number>', 'custom jwt expire time(d)')

  // cluster
  .option('--cluster', 'enable cluster mode')
  .option('--cluster_workers <number>', 'cluster worker count')

  // debug
  .option('--http_request_verbose', 'enable http request verbose')

  // cache
  .option('--http_cache_ttl <number>', 'http cache ttl')
  .option(
    '--http_cache_enable_cdn_header',
    'enable http cache cdn header, s-maxage',
  )
  .option(
    '--http_cache_enable_force_cache_header',
    'enable http cache force cache header, max-age',
  )

  // security
  .option(
    '--encrypt_key <string>',
    'custom encrypt key, default is machine-id',
    ENCRYPT_KEY_FROM_ENV,
  )
  .option(
    '--encrypt_enable',
    'enable encrypt security field, please remember encrypt key.',
  )
  .option(
    '--encrypt_algorithm <string>',
    'custom encrypt algorithm, default is aes-256-ecb',
  )
  // throttle
  .option('--throttle_ttl <number>', 'throttle ttl')
  .option('--throttle_limit <number>', 'throttle limit')

  // other
  .option('--color', 'force enable shell color')

  // debug
  .option(
    '--debug_memory_dump',
    'enable memory dump for debug, send SIGUSR2 to dump memory',
  )

  // telemetry
  .option('--disable_telemetry', 'disable anonymous telemetry')

commander.parse()

const argv = commander.opts()

if (argv.config) {
  const config = yamlLoad(
    readFileSync(path.join(String(process.cwd()), argv.config), 'utf8'),
  )
  Object.assign(argv, config)
}

applyArgvEnvFallback(argv)

export const PORT = argv.port || 2333
export const API_VERSION = 2

export const DEMO_MODE = argv.demo || false

export const CROSS_DOMAIN = {
  allowedOrigins: argv.allowed_origins
    ? argv.allowed_origins?.split?.(',')
    : [
        'innei.ren',
        '*.innei.ren',

        'localhost:*',
        '127.0.0.1',
        'mbp.cc',
        'local.innei.test',
        '22333322.xyz',
        '*.dev',
        '*.vercel.app',
        'innei.in',
        '*.innei.in',

        'localhost:9528',
        'localhost:2323',
      ],

  // allowedReferer: 'innei.ren',
}

const customConnectionString = argv.db_connection_string || MONGO_CONNECTION

function buildMongoConnectionString(
  connectionString: string,
  dbName: string,
): string {
  const url = new URL(connectionString)
  // Replace or set the pathname to the database name
  url.pathname = `/${dbName}`
  return url.toString()
}

export const MONGO_DB = {
  dbName: argv.collection_name || 'mx-space',
  host: argv.db_host || '127.0.0.1',
  // host: argv.db_host || '10.0.0.33',
  port: argv.db_port || 27017,
  user: argv.db_user || '',
  password: argv.db_password || '',
  options: argv.db_options || '',
  get uri() {
    const userPassword =
      this.user && this.password ? `${this.user}:${this.password}@` : ''
    const dbOptions = this.options ? `?${this.options}` : ''
    return `mongodb://${userPassword}${this.host}:${this.port}/${this.dbName}${dbOptions}`
  },
  get customConnectionString() {
    return customConnectionString
      ? buildMongoConnectionString(customConnectionString, this.dbName)
      : undefined
  },
}

const redisConnection = argv.redis_connection_string
  ? parseRedisConnectionString(argv.redis_connection_string)
  : null

export const REDIS = {
  host: redisConnection?.host || argv.redis_host || 'localhost',
  port: redisConnection?.port || argv.redis_port || 6379,
  username: redisConnection?.username,
  password: redisConnection?.password || argv.redis_password || null,
  db: redisConnection?.db,
  url: redisConnection?.url,
  tls: redisConnection?.tls ?? false,
  ttl: null,
  max: 120,
  disableApiCache: isDev,
  // disableApiCache: false,
}

export const HTTP_CACHE = {
  ttl: 15, // s
  enableCDNHeader:
    parseBooleanishValue(
      (argv.http_cache_enable_cdn_header ?? CDN_CACHE_HEADER) as unknown as
        | string
        | boolean
        | undefined,
    ) ?? true, // s-maxage
  enableForceCacheHeader:
    parseBooleanishValue(
      (argv.http_cache_enable_force_cache_header ??
        FORCE_CACHE_HEADER) as unknown as string | boolean | undefined,
    ) ?? false, // cache-control: max-age
}

export const AXIOS_CONFIG: AxiosRequestConfig = {
  timeout: 10000,
  ...(isDev && {
    httpsAgent: new https.Agent({ rejectUnauthorized: false }),
  }),
}

export const SECURITY = {
  jwtSecret: argv.jwt_secret || argv.jwtSecret || ENV_JWT_SECRET,
  jwtExpire: +argv.jwt_expire || 14,
}

export const CLUSTER = {
  enable: argv.cluster ?? false,
  workers: argv.cluster_workers,
}

export const DEBUG_MODE = {
  logging: isDebugMode,
  httpRequestVerbose:
    argv.httpRequestVerbose ?? argv.http_request_verbose ?? true,
  memoryDump:
    parseBooleanishValue(
      argv.debug_memory_dump ??
        process.env.DEBUG_MEMORY_DUMP ??
        process.env.MX_DEBUG_MEMORY_DUMP,
    ) ?? false,
}
export const THROTTLE_OPTIONS = {
  ttl: seconds(Number(argv.throttle_ttl ?? THROTTLE_TTL ?? 10)),
  limit: Number(argv.throttle_limit ?? THROTTLE_LIMIT ?? 100),
}

const ENCRYPT_KEY = argv.encrypt_key
export const ENCRYPT = {
  key: ENCRYPT_KEY || machineIdSync(),
  enable:
    parseBooleanishValue(argv.encrypt_enable ?? ENCRYPT_ENABLE_FROM_ENV) ??
    !!ENCRYPT_KEY,
  algorithm: argv.encrypt_algorithm || 'aes-256-ecb',
}

if (ENCRYPT.enable && (!ENCRYPT.key || ENCRYPT.key.length !== 64))
  throw new Error(
    `你开启了 Key 加密（MX_ENCRYPT_KEY or --encrypt_key），但是 Key 的长度不为 64，当前：${ENCRYPT.key.length}`,
  )

export const TELEMETRY = {
  enable: !parseBooleanishValue(argv.disable_telemetry ?? MX_DISABLE_TELEMETRY),
}
