import { CronTaskStatus, CronTaskType } from '~/api/cron-tasks'
import type { TranslationKey } from '~/i18n/types'
import { adminQueryKeys } from '~/query/keys'
import type { BadgeTone } from '~/ui/primitives/badge'

export const definitionQueryKey = adminQueryKeys.cron.definitionRoot

export const definitionStaleTime = 60000

export const taskTypeLabelKeys: Record<CronTaskType, TranslationKey> = {
  [CronTaskType.CleanAccessRecord]: 'cron.taskType.cleanAccessRecord',
  [CronTaskType.CleanCommentUploads]: 'cron.taskType.cleanCommentUploads',
  [CronTaskType.CleanTempDirectory]: 'cron.taskType.cleanTempDirectory',
  [CronTaskType.DeleteExpiredJWT]: 'cron.taskType.deleteExpiredJWT',
  [CronTaskType.PushToBaiduSearch]: 'cron.taskType.pushToBaiduSearch',
  [CronTaskType.PushToBingSearch]: 'cron.taskType.pushToBingSearch',
  [CronTaskType.RebuildSearchIndex]: 'cron.taskType.rebuildSearchIndex',
  [CronTaskType.ResetIPAccess]: 'cron.taskType.resetIPAccess',
  [CronTaskType.ResetLikedOrReadArticleRecord]:
    'cron.taskType.resetLikedOrReadArticleRecord',
}

export const taskStatusLabelKeys: Record<CronTaskStatus, TranslationKey> = {
  [CronTaskStatus.Cancelled]: 'cron.taskStatus.cancelled',
  [CronTaskStatus.Completed]: 'cron.taskStatus.completed',
  [CronTaskStatus.Failed]: 'cron.taskStatus.failed',
  [CronTaskStatus.PartialFailed]: 'cron.taskStatus.partialFailed',
  [CronTaskStatus.Pending]: 'cron.taskStatus.pending',
  [CronTaskStatus.Running]: 'cron.taskStatus.running',
}

export const taskStatusTones: Record<CronTaskStatus, BadgeTone> = {
  [CronTaskStatus.Cancelled]: 'neutral',
  [CronTaskStatus.Completed]: 'success',
  [CronTaskStatus.Failed]: 'danger',
  [CronTaskStatus.PartialFailed]: 'warning',
  [CronTaskStatus.Pending]: 'neutral',
  [CronTaskStatus.Running]: 'info',
}
