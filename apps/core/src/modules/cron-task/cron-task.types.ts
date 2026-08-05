export const CronTaskType = {
  CleanAccessRecord: 'cron:clean-access-record',
  ResetIPAccess: 'cron:reset-ip-access',
  ResetLikedOrReadArticleRecord: 'cron:reset-liked-or-read',
  CleanTempDirectory: 'cron:clean-temp-directory',
  PushToBaiduSearch: 'cron:push-to-baidu-search',
  PushToBingSearch: 'cron:push-to-bing-search',
  DeleteExpiredJWT: 'cron:delete-expired-jwt',
  RebuildSearchIndex: 'cron:rebuild-search-index',
  CleanCommentUploads: 'cron:clean-comment-uploads',
} as const

export type CronTaskTypeValue = (typeof CronTaskType)[keyof typeof CronTaskType]

export interface CronTaskMeta {
  type: CronTaskTypeValue
  name: string
  description: string
  cronExpression: string
  methodName: string
}

export const CronTaskMetas: Record<
  CronTaskTypeValue,
  Omit<CronTaskMeta, 'type'>
> = {
  [CronTaskType.CleanAccessRecord]: {
    name: 'cleanAccessRecord',
    description: 'Clean up access records',
    cronExpression: 'EVERY_1ST_DAY_OF_MONTH_AT_MIDNIGHT',
    methodName: 'cleanAccessRecord',
  },
  [CronTaskType.ResetIPAccess]: {
    name: 'resetIPAccess',
    description: 'Clean up IP access records',
    cronExpression: 'EVERY_DAY_AT_MIDNIGHT',
    methodName: 'resetIPAccess',
  },
  [CronTaskType.ResetLikedOrReadArticleRecord]: {
    name: 'resetLikedOrReadArticleRecord',
    description: 'Clean up like counts',
    cronExpression: 'EVERY_DAY_AT_MIDNIGHT',
    methodName: 'resetLikedOrReadArticleRecord',
  },
  [CronTaskType.CleanTempDirectory]: {
    name: 'cleanTempDirectory',
    description: 'Clean up temporary files',
    cronExpression: 'EVERY_DAY_AT_3AM',
    methodName: 'cleanTempDirectory',
  },
  [CronTaskType.PushToBaiduSearch]: {
    name: 'pushToBaiduSearch',
    description: 'Push to Baidu Search',
    cronExpression: 'EVERY_DAY_AT_1AM',
    methodName: 'pushToBaiduSearch',
  },
  [CronTaskType.PushToBingSearch]: {
    name: 'pushToBingSearch',
    description: 'Push to Bing',
    cronExpression: 'EVERY_DAY_AT_1AM',
    methodName: 'pushToBingSearch',
  },
  [CronTaskType.DeleteExpiredJWT]: {
    name: 'deleteExpiredJWT',
    description: 'Delete expired JWTs',
    cronExpression: 'EVERY_DAY_AT_1AM',
    methodName: 'deleteExpiredJWT',
  },
  [CronTaskType.RebuildSearchIndex]: {
    name: 'rebuildSearchIndex',
    description: 'Rebuild search index',
    cronExpression: 'EVERY_DAY_AT_4AM',
    methodName: 'rebuildSearchIndex',
  },
  [CronTaskType.CleanCommentUploads]: {
    name: 'cleanCommentUploads',
    description: 'Clean up comment image uploads',
    cronExpression: '*/15 * * * *',
    methodName: 'cleanCommentUploads',
  },
}

export interface CronTaskDefinition {
  type: CronTaskTypeValue
  name: string
  description: string
  cronExpression: string
  lastDate?: string | null
  nextDate?: string | null
}

export interface CronTaskResult {
  [key: string]: unknown
}
