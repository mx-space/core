export enum RedisKeys {
  AccessIp = 'access_ip',
  Like = 'like',
  Read = 'read',
  LoginRecord = 'login_record',
  MaxOnlineCount = 'max_online_count',
  IpInfoMap = 'ip_info_map',
  LikeSite = 'like_site',
  /** Admin dashboard entry page cache */
  AdminPage = 'admin_next_index_entry',
  /** Configuration cache */
  ConfigCache = 'config_cache',
  /** Configuration version number */
  ConfigVersion = 'config_version',
  PTYSession = 'pty_session',
  /** HTTP request cache */
  HTTPCache = 'http_cache',
  /** Snippet cache */
  SnippetCache = 'snippet_cache',
  /** Translation glossary cache */
  TranslationEntryDict = 'translation_entry_dict',

  /** Serverless function cache storage */
  ServerlessStorage = 'serverless_storage',

  JWTStore = 'jwt_store',
  /** Like/dislike records for recent shorthand entries */
  RecentlyAttitude = 'recently_attitude',
  Socket = 'socket',
  ClusterEventStream = 'cluster_event_stream',

  AnalyzeAggregate = 'analyze_aggregate',
  AnalyzeTrafficSource = 'analyze_traffic_source',
  AnalyzeDeviceDistribution = 'analyze_device_distribution',

  /** NX lock to throttle Enrichment capture LRU touchAccess */
  EnrichmentCaptureTouch = 'enrichment_capture_touch',
}
export const API_CACHE_PREFIX = 'mx-api-cache:'
export enum CacheKeys {
  SiteMap = `${API_CACHE_PREFIX}aggregate_sitemap`,
  SiteMapXml = `${API_CACHE_PREFIX}aggregate_sitemap_xml`,
  RSS = `${API_CACHE_PREFIX}rss`,
  RSSXml = `${API_CACHE_PREFIX}rss_xml`,
  Aggregate = `${API_CACHE_PREFIX}aggregate`,
  AggregateSite = `${API_CACHE_PREFIX}aggregate_site`,
}
