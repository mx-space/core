export enum RedisKeys {
  Access = 'access',
  Like = 'like',
  Read = 'read',
  LoginRecord = 'login_record',
  MaxOnlineCount = 'max_online_count',
}
export enum RedisItems {
  Ips = 'ips',
}

export const CacheKeys = Object.freeze({
  AggregateCatch: 'mx:aggregate_catch',
  SiteMapCatch: 'mx:aggregate_sitemap_catch',
  RSS: 'mx:rss',
} as const)
