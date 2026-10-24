export enum EventBusEvents {
  EmailInit = 'email.init',
  TokenExpired = 'token.expired',
  OwnerRolesChanged = 'auth.owner-roles-changed',
  CleanAggregateCache = 'cache.aggregate',
  SystemException = 'system.exception',
  ConfigChanged = 'config.changed',
}
