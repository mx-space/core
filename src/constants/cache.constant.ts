export enum RedisKeys {
  AccessIp = 'access_ip',
  Like = 'like',
  Read = 'read',
  LoginRecord = 'login_record',
  MaxOnlineCount = 'max_online_count',
  IpInfoMap = 'ip_info_map',
  LikeSite = 'like_site',
  /** 后台管理入口页面缓存 */
  AdminPage = 'admin_next_index_entry',
  /** 配置项缓存 */
  ConfigCache = 'config_cache',
  PTYSession = 'pty_session',
  /** HTTP 请求缓存 */
  HTTPCache = 'http_cache',
  /** Snippet 缓存 */
  SnippetCache = 'snippet_cache',

  /** 云函数缓存数据 */
  ServerlessStorage = 'serverless_storage',

  JWTStore = 'jwt_store',

  /**
   * install dependencies queue
   */
  DependencyQueue = 'dependency_queue',
}

export enum CacheKeys {
  AggregateCatch = 'mx-api-cache:aggregate_catch',
  SiteMapCatch = 'mx-api-cache:aggregate_sitemap_catch',
  SiteMapXmlCatch = 'mx-api-cache:aggregate_sitemap_xml_catch',
  RSS = 'mx-api-cache:rss',
  RSSXmlCatch = 'mx-api-cache:rss_xml_catch',
}
