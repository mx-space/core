export enum EventBusEvents {
  EmailInit = 'email.init',
  TokenExpired = 'token.expired',
  CleanAggregateCache = 'cache.aggregate',
  SystemException = 'system.exception',
  ConfigChanged = 'config.changed',
  OauthChanged = 'oauth.changed',
  AppUrlChanged = 'app.url.changed',
  AdminDashboardUpdateTriggered = 'admin.dashboard.update.triggered',
}
