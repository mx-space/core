import {
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  Clock,
  Loader2,
  XCircle,
} from 'lucide-react'
import type { TranslationKey } from '~/i18n/types'
import type { LucideIcon } from 'lucide-react'

import { CronTaskStatus, CronTaskType } from '~/api/cron-tasks'
import { adminQueryKeys } from '~/query/keys'
import type { BadgeTone } from '~/ui/primitives/badge'

export const taskQueryKey = adminQueryKeys.cron.taskRoot
export const definitionQueryKey = adminQueryKeys.cron.definitionRoot

export const taskListPageSize = 50
export const taskRefetchInterval = 5000
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

export const taskStatusIcons: Record<CronTaskStatus, LucideIcon> = {
  [CronTaskStatus.Cancelled]: XCircle,
  [CronTaskStatus.Completed]: CheckCircle,
  [CronTaskStatus.Failed]: AlertCircle,
  [CronTaskStatus.PartialFailed]: AlertTriangle,
  [CronTaskStatus.Pending]: Clock,
  [CronTaskStatus.Running]: Loader2,
}

export const taskStatusTones: Record<CronTaskStatus, BadgeTone> = {
  [CronTaskStatus.Cancelled]: 'neutral',
  [CronTaskStatus.Completed]: 'success',
  [CronTaskStatus.Failed]: 'danger',
  [CronTaskStatus.PartialFailed]: 'warning',
  [CronTaskStatus.Pending]: 'neutral',
  [CronTaskStatus.Running]: 'info',
}

export const taskStatusIconClassNames: Record<CronTaskStatus, string> = {
  [CronTaskStatus.Cancelled]: 'text-neutral-400',
  [CronTaskStatus.Completed]: 'text-emerald-500',
  [CronTaskStatus.Failed]: 'text-red-500',
  [CronTaskStatus.PartialFailed]: 'text-amber-500',
  [CronTaskStatus.Pending]: 'text-neutral-400',
  [CronTaskStatus.Running]: 'animate-spin text-blue-500',
}

export const statusOptionKeys: Array<{
  labelKey?: TranslationKey
  labelText?: string
  value: string
}> = [
  { labelKey: 'cron.filter.allStatus', value: '' },
  ...Object.values(CronTaskStatus).map((status) => ({
    labelKey: taskStatusLabelKeys[status],
    value: status,
  })),
]

export const typeOptionKeys: Array<{
  labelKey?: TranslationKey
  labelText?: string
  value: string
}> = [
  { labelKey: 'cron.filter.allType', value: '' },
  ...Object.values(CronTaskType).map((type) => ({
    labelKey: taskTypeLabelKeys[type],
    value: type,
  })),
]
