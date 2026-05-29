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

export const taskQueryKey = ['cron-tasks'] as const
export const definitionQueryKey = ['cron-task-definitions'] as const

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

export const taskStatusClassNames: Record<CronTaskStatus, string> = {
  [CronTaskStatus.Cancelled]:
    'border-neutral-200 bg-neutral-50 text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400',
  [CronTaskStatus.Completed]:
    'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300',
  [CronTaskStatus.Failed]:
    'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300',
  [CronTaskStatus.PartialFailed]:
    'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-300',
  [CronTaskStatus.Pending]:
    'border-neutral-200 bg-white text-neutral-600 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-300',
  [CronTaskStatus.Running]:
    'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/50 dark:text-blue-300',
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
