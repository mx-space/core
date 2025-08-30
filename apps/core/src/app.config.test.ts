import { argv } from '@mx-space/compiled'
import type { AxiosRequestConfig } from 'axios'

export const PORT = process.env.PORT || 2333
export const API_VERSION = 2

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
    return `mongodb://${userPassword}${this.host}:${this.port}/${'mx-space_unitest'}`
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

export const THROTTLE_OPTIONS = {
  ttl: 10_000,
  limit: 50,
}
