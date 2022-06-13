import { AxiosRequestConfig } from 'axios'
import cluster from 'cluster'
import { argv } from 'zx-cjs'

export const isDev = process.env.NODE_ENV == 'development'

export const isTest = !!process.env.TEST
export const cwd = process.cwd()

export const PORT = argv.port || process.env.PORT || 2333
export const API_VERSION = 2

export const isInDemoMode = argv.demo || false

export const CROSS_DOMAIN = {
  allowedOrigins: argv.allowed_origins
    ? argv.allowed_origins?.split?.(',')
    : [
        'innei.ren',
        'shizuri.net',
        'localhost',
        '127.0.0.1',
        'mbp.cc',
        'local.innei.test',
        '22333322.xyz',
        '.*dev',
      ],

  // allowedReferer: 'innei.ren',
}

export const MONGO_DB = {
  dbName: argv.collection_name || (isInDemoMode ? 'mx-space_demo' : 'mx-space'),
  host: argv.db_host || '127.0.0.1',
  port: argv.db_port || 27017,
  get uri() {
    return `mongodb://${this.host}:${this.port}/${
      isTest ? 'mx-space_unitest' : this.dbName
    }`
  },
}

export const REDIS = {
  host: argv.redis_host || 'localhost',
  port: argv.redis_port || 6379,
  password: argv.redis_password || null,
  ttl: null,
  httpCacheTTL: 5,
  max: 5,
  disableApiCache:
    (isDev || argv.disable_cache) && !process.env['ENABLE_CACHE_DEBUG'],
}

export const AXIOS_CONFIG: AxiosRequestConfig = {
  timeout: 10000,
}

export const SECURITY = {
  jwtSecret: argv.jwt_secret || argv.jwtSecret,
  jwtExpire: '7d',
  // 跳过登陆鉴权
  skipAuth: isTest ? true : false,
}

export const CLUSTER = {
  enable: argv.cluster ?? false,
  workers: argv.cluster_workers,
}

/** Is main cluster in PM2 */
export const isMainCluster =
  process.env.NODE_APP_INSTANCE && parseInt(process.env.NODE_APP_INSTANCE) === 0
export const isMainProcess = cluster.isPrimary || isMainCluster

export const DEBUG_MODE = {
  httpRequestVerbose:
    argv.httpRequestVerbose ?? argv.http_request_verbose ?? true,
}

if (!CLUSTER.enable || cluster.isPrimary || isMainCluster) {
  console.log(argv)
  console.log('cwd: ', cwd)
}
