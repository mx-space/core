import argv from 'argv'
export const CROSS_DOMAIN = {
  allowedOrigins: [
    'innei.ren',
    'shizuri.net',
    'localhost:9528',
    'localhost:2323',
    '127.0.0.1',
    'mbp.cc',
    'local.innei.test',
    '22333322.xyz',
  ],
  allowedReferer: 'innei.ren',
}

export const MONGO_DB = {
  uri: `mongodb://127.0.0.1:${argv.dbport || '27017'}/mx-space`,
}

export const REDIS = {
  host: argv.redis_host || 'localhost',
  port: argv.redis_port || 6379,
  password: (argv.redis_password || null) as string,
  ttl: null,
  defaultCacheTTL: 60 * 60 * 24,
}
