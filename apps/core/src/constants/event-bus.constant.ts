export enum EventBusEvents {
  EmailInit = 'email.init',
  TokenExpired = 'token.expired',
  CleanAggregateCache = 'cache.aggregate',
  SystemException = 'system.exception',
  ConfigChanged = 'config.changed',
}
