import { readFileSync } from 'node:fs'
import path from 'node:path'
import { seconds } from '@nestjs/throttler'
import type { AxiosRequestConfig } from 'axios'
import { program } from 'commander'
import { load as yamlLoad } from 'js-yaml'
import { machineIdSync } from 'node-machine-id'
import { isDebugMode, isDev } from './global/env.global'
import { parseBooleanishValue } from './utils/tool.util'

const { PORT: ENV_PORT, ALLOWED_ORIGINS, MX_ENCRYPT_KEY } = process.env

const commander = program
  .option('-p, --port <number>', 'server port', ENV_PORT)

  .option(
    '--allowed_origins <string>',
    'allowed origins, e.g. innei.ren,*.innei.ren',
    ALLOWED_ORIGINS,
  )
  .option('-c, --config <path>', 'load yaml config from file')

  // db
  .option('--collection_name <string>', 'mongodb collection name')
  .option('--db_host <string>', 'mongodb database host')
  .option('--db_port <number>', 'mongodb database port')
  .option('--db_user <string>', 'mongodb database user')
  .option('--db_password <string>', 'mongodb database password')
  .option('--db_options <string>', 'mongodb database options')
  .option('--db_connection_string <string>', 'mongodb connection string')
  // redis
  .option('--redis_host <string>', 'redis host')
  .option('--redis_port <number>', 'redis port')
  .option('--redis_password <string>', 'redis password')
  .option('--disable_cache', 'disable redis cache')

  // jwt
  .option('--jwt_secret <string>', 'custom jwt secret')
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
    MX_ENCRYPT_KEY,
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

commander.parse()

const argv = commander.opts()

if (argv.config) {
  const config = yamlLoad(
    readFileSync(path.join(String(process.cwd()), argv.config), 'utf8'),
  )
  Object.assign(argv, config)
}

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
  customConnectionString: argv.db_connection_string,
}

export const REDIS = {
  host: argv.redis_host || 'localhost',
  port: argv.redis_port || 6379,
  password: argv.redis_password || null,
  ttl: null,
  max: 120,
  disableApiCache: isDev,
  // disableApiCache: false,
}

export const HTTP_CACHE = {
  ttl: 15, // s
  enableCDNHeader:
    parseBooleanishValue(argv.http_cache_enable_cdn_header) ?? true, // s-maxage
  enableForceCacheHeader:
    parseBooleanishValue(argv.http_cache_enable_force_cache_header) ?? false, // cache-control: max-age
}

export const AXIOS_CONFIG: AxiosRequestConfig = {
  timeout: 10000,
}

export const SECURITY = {
  jwtSecret: argv.jwt_secret || argv.jwtSecret,
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
    (argv.debug_memory_dump || process.env.MX_DEBUG_MEMORY_DUMP) ?? false,
}
export const THROTTLE_OPTIONS = {
  ttl: seconds(argv.throttle_ttl ?? 10),
  limit: argv.throttle_limit ?? 100,
}

const ENCRYPT_KEY = argv.encrypt_key
export const ENCRYPT = {
  key: ENCRYPT_KEY || machineIdSync(),
  enable: parseBooleanishValue(argv.encrypt_enable) ?? !!ENCRYPT_KEY,
  algorithm: argv.encrypt_algorithm || 'aes-256-ecb',
}

if (ENCRYPT.enable && (!ENCRYPT.key || ENCRYPT.key.length !== 64))
  throw new Error(
    `你开启了 Key 加密（MX_ENCRYPT_KEY or --encrypt_key），但是 Key 的长度不为 64，当前：${ENCRYPT.key.length}`,
  )
