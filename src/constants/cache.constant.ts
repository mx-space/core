export enum RedisKeys {
  Access = 'access',
  Like = 'like',
  Read = 'read',
  LoginRecord = 'login_record',
  MaxOnlineCount = 'max_online_count',
  IpInfoMap = 'ip_info_map',
  LikeSite = 'like_site',
}

export enum RedisItems {
  Ips = 'ips',
}

export const CacheKeys = Object.freeze({
  AggregateCatch: 'mx-api-cache:aggregate_catch',
  SiteMapCatch: 'mx-api-cache:aggregate_sitemap_catch',
  RSS: 'mx-api-cache:rss',
  RSSCatch: 'mx-api-cache:rss_catch',
} as const)
