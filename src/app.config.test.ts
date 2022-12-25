/* eslint-disable @typescript-eslint/consistent-type-imports */
import type { AxiosRequestConfig } from 'axios'
import { program } from 'commander'
import { readFileSync } from 'fs'
import { load as yamlLoad } from 'js-yaml'
import path from 'path'

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
  .option('--encrypt_key', 'custom encrypt key, default is machine-id')
  .option(
    '--encrypt_enable',
    'enable encrypt security field, please remember encrypt key.',
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

export const PORT = process.env.PORT || 2333
export const API_VERSION = 2

export const DEMO_MODE = false

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
      ],

  // allowedReferer: 'innei.ren',
}

export const MONGO_DB = {
  dbName: 'mx-space',
  host: '127.0.0.1',
  port: 27017,
  user: '',
  password: argv.db_password || '',
  get uri() {
    const userPassword =
      this.user && this.password ? `${this.user}:${this.password}@` : ''
    return `mongodb://${userPassword}${this.host}:${
      this.port
    }/${'mx-space_unitest'}`
  },
}

export const REDIS = {
  host: 'localhost',
  port: 6379,
  password: null,
  ttl: null,
  httpCacheTTL: 5,
  max: 5,
  disableApiCache: true,
}

export const AXIOS_CONFIG: AxiosRequestConfig = {
  timeout: 10000,
}

export const SECURITY = {
  jwtSecret: argv.jwt_secret || argv.jwtSecret,
  jwtExpire: +argv.jwt_expire || 14,
  // 跳过登陆鉴权
  skipAuth: true,
}

export const CLUSTER = {
  enable: argv.cluster ?? false,
  workers: argv.cluster_workers,
}

export const DEBUG_MODE = {
  httpRequestVerbose: false,
}

export const ENCRYPT = {
  key: '593f62860255feb0a914534a43814b9809cc7534da7f5485cd2e3d3c8609acab',
  enable: true,
}
