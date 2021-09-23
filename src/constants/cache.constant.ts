export enum RedisKeys {
  Access = 'access',
  Like = 'like',
  Read = 'read',
  LoginRecord = 'login_record',
  MaxOnlineCount = 'max_online_count',
  IpInfoMap = 'ip_info_map',
  LikeSite = 'like_site',
  AdminPage = 'admin_next_index_entry',
}

export enum RedisItems {
  Ips = 'ips',
}

export enum CacheKeys {
  AggregateCatch = 'mx-api-cache:aggregate_catch',
  SiteMapCatch = 'mx-api-cache:aggregate_sitemap_catch',
  SiteMapXmlCatch = 'mx-api-cache:aggregate_sitemap_xml_catch',
  RSS = 'mx-api-cache:rss',
  RSSXmlCatch = 'mx-api-cache:rss_xml_catch',
}
