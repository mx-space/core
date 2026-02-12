import type { AxiosRequestConfig } from 'axios'

export const PORT = process.env.PORT || 2333
export const API_VERSION = 2

export const CROSS_DOMAIN = {
  allowedOrigins: process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',')
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
  password: process.env.DB_PASSWORD || '',
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
  jwtSecret: process.env.JWT_SECRET,
  jwtExpire: Number(process.env.JWT_EXPIRE) || 14,
}

export const CLUSTER = {
  enable: process.env.CLUSTER === 'true',
  workers: process.env.CLUSTER_WORKERS,
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
