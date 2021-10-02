const yargs = require('yargs')
const isDev = process.env.NODE_ENV === 'development'

Object.defineProperty(exports, '__esModule', { value: true })

/**
 * @type {any}
 */
const argv = yargs.argv
console.log(argv)

exports.API_VERSION = 2
exports.CROSS_DOMAIN = {
  allowedOrigins: argv.allowed_origins
    ? argv.allowedOrigins?.split?.(',')
    : [
        'innei.ren',
        'shizuri.net',
        'localhost:9528',
        'localhost:2323',
        '127.0.0.1',
        'mbp.cc',
        'local.innei.test',
        '22333322.xyz',
      ],
  // allowedReferer: 'innei.ren',
}

exports.MONGO_DB = {
  dbName: argv.collection_name || 'mx-space',
  host: argv.db_host || '127.0.0.1',
  port: argv.db_port || 27017,
  get uri() {
    return `mongodb://${this.host}:${this.port}/${
      process.env.TEST ? 'mx-space_unitest' : this.dbName
    }`
  },
}

exports.REDIS = {
  host: argv.redis_host || 'localhost',
  port: argv.redis_port || 6379,
  password: argv.redis_password || null,
  ttl: null,
  httpCacheTTL: 5,
  max: 5,
  disableApiCache:
    (isDev || argv.disable_cache) && !process.env['ENABLE_CACHE_DEBUG'],
}

/**
 * @type {import('axios').AxiosRequestConfig}
 */
exports.AXIOS_CONFIG = {
  timeout: 10000,
}

exports.SECURITY = {
  jwtSecret: argv.jwt_secret || argv.jwtSecret || 'asjhczxiucipoiopiqm2376',
  jwtExpire: '7d',
  // 跳过登陆鉴权
  skipAuth: !isDev ? true : argv.skip_auth ?? false,
}
