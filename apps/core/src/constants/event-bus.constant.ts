export enum EventBusEvents {
  EmailInit = 'email.init',
  PushSearch = 'search.push',
  TokenExpired = 'token.expired',
  CleanAggregateCache = 'cache.aggregate',
  SystemException = 'system.exception',
  ConfigChanged = 'config.changed',
  OauthChanged = 'oauth.changed',
}
