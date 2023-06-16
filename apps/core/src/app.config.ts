/* eslint-disable @typescript-eslint/consistent-type-imports */
import { readFileSync } from 'fs'
import path from 'path'
import { program } from 'commander'
import { load as yamlLoad } from 'js-yaml'
import { machineIdSync } from 'node-machine-id'
import type { AxiosRequestConfig } from 'axios'

import { isDebugMode } from './global/env.global'
import { parseBooleanishValue } from './utils'

const commander = program
  .option('-p, --port <number>', 'server port')
  .option('--demo', 'enable demo mode')
  .option(
    '--allowed_origins <string>',
    'allowed origins, e.g. innei.ren,*.innei.ren',
  )
  .option('-c, --config <path>', 'load yaml config from file')

  // db
  .option('--collection_name <string>', 'mongodb collection name')
  .option('--db_host <string>', 'mongodb database host')
  .option('--db_port <number>', 'mongodb database port')
  .option('--db_user <string>', 'mongodb database user')
  .option('--db_password <string>', 'mongodb database password')

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

  // security
  .option('--encrypt_key <string>', 'custom encrypt key, default is machine-id')
  .option(
    '--encrypt_enable',
    'enable encrypt security field, please remember encrypt key.',
  )
  .option(
    '--encrypt_algorithm <string>',
    'custom encrypt algorithm, default is aes-256-ecb',
  )

  // other
  .option('--color', 'force enable shell color')

commander.parse()

const argv = commander.opts()

if (argv.config) {
  const config = yamlLoad(
    readFileSync(path.join(String(process.cwd()), argv.config), 'utf8'),
  )
  Object.assign(argv, config)
}

const { PORT: ENV_PORT, MX_ENCRYPT_KEY } = process.env

export const PORT = argv.port || ENV_PORT || 2333
export const API_VERSION = 2

export const DEMO_MODE = argv.demo || false

export const CROSS_DOMAIN = {
  allowedOrigins: argv.allowed_origins
    ? argv.allowed_origins?.split?.(',')
    : [
        'innei.ren',
        '*.innei.ren',
        'shizuri.net',
        '*.shizuri.net',
        'localhost:*',
        '127.0.0.1',
        'mbp.cc',
        'local.innei.test',
        '22333322.xyz',
        '*.dev',
        '*.vercel.app',
      ],

  // allowedReferer: 'innei.ren',
}

export const MONGO_DB = {
  dbName: argv.collection_name || (DEMO_MODE ? 'mx-space_demo' : 'mx-space'),
  host: argv.db_host || '127.0.0.1',
  port: argv.db_port || 27017,
  user: argv.db_user || '',
  password: argv.db_password || '',
  get uri() {
    const userPassword =
      this.user && this.password ? `${this.user}:${this.password}@` : ''
    return `mongodb://${userPassword}${this.host}:${this.port}/${this.dbName}`
  },
}

export const REDIS = {
  host: argv.redis_host || 'localhost',
  port: argv.redis_port || 6379,
  password: argv.redis_password || null,
  ttl: null,
  httpCacheTTL: 15,
  max: 120,
  disableApiCache: false,
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
}

const ENCRYPT_KEY = argv.encrypt_key || MX_ENCRYPT_KEY
export const ENCRYPT = {
  key: ENCRYPT_KEY || machineIdSync(),
  enable: parseBooleanishValue(argv.encrypt_enable) ? !!ENCRYPT_KEY : false,
  algorithm: argv.encrypt_algorithm || 'aes-256-ecb',
}
