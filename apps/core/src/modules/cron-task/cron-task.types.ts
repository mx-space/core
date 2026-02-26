export const CronTaskType = {
  CleanAccessRecord: 'cron:clean-access-record',
  ResetIPAccess: 'cron:reset-ip-access',
  ResetLikedOrReadArticleRecord: 'cron:reset-liked-or-read',
  CleanTempDirectory: 'cron:clean-temp-directory',
  PushToBaiduSearch: 'cron:push-to-baidu-search',
  PushToBingSearch: 'cron:push-to-bing-search',
  DeleteExpiredJWT: 'cron:delete-expired-jwt',
  CleanupOrphanImages: 'cron:cleanup-orphan-images',
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
    description: '清理访问记录',
    cronExpression: 'EVERY_1ST_DAY_OF_MONTH_AT_MIDNIGHT',
    methodName: 'cleanAccessRecord',
  },
  [CronTaskType.ResetIPAccess]: {
    name: 'resetIPAccess',
    description: '清理 IP 访问记录',
    cronExpression: 'EVERY_DAY_AT_MIDNIGHT',
    methodName: 'resetIPAccess',
  },
  [CronTaskType.ResetLikedOrReadArticleRecord]: {
    name: 'resetLikedOrReadArticleRecord',
    description: '清理喜欢数',
    cronExpression: 'EVERY_DAY_AT_MIDNIGHT',
    methodName: 'resetLikedOrReadArticleRecord',
  },
  [CronTaskType.CleanTempDirectory]: {
    name: 'cleanTempDirectory',
    description: '清理临时文件',
    cronExpression: 'EVERY_DAY_AT_3AM',
    methodName: 'cleanTempDirectory',
  },
  [CronTaskType.PushToBaiduSearch]: {
    name: 'pushToBaiduSearch',
    description: '推送到百度搜索',
    cronExpression: 'EVERY_DAY_AT_1AM',
    methodName: 'pushToBaiduSearch',
  },
  [CronTaskType.PushToBingSearch]: {
    name: 'pushToBingSearch',
    description: '推送到 Bing',
    cronExpression: 'EVERY_DAY_AT_1AM',
    methodName: 'pushToBingSearch',
  },
  [CronTaskType.DeleteExpiredJWT]: {
    name: 'deleteExpiredJWT',
    description: '删除过期 JWT',
    cronExpression: 'EVERY_DAY_AT_1AM',
    methodName: 'deleteExpiredJWT',
  },
  [CronTaskType.CleanupOrphanImages]: {
    name: 'cleanupOrphanImages',
    description: '清理孤儿图片',
    cronExpression: 'EVERY_HOUR',
    methodName: 'cleanupOrphanImages',
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
