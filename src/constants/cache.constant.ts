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
  AggregateCatch: 'mx:aggregate_catch',
  SiteMapCatch: 'mx:aggregate_sitemap_catch',
  RSS: 'mx:rss',
  RSSCatch: 'mx:rss_catch',
} as const)
