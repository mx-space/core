import type { LucideIcon } from 'lucide-react'
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Loader2,
  XCircle,
} from 'lucide-react'

import type { TaskScope } from '~/api/tasks'
import { AITaskStatus, AITaskType } from '~/api/tasks'
import type { TranslationKey } from '~/i18n/types'
import { adminQueryKeys } from '~/query/keys'

export const tasksQueryKey = adminQueryKeys.tasks.tasksRoot

export const pageSize = 50

export const liveSubscribeIntervalMs = 30_000
export const fallbackPollingIntervalMs = 5_000

export const taskTypeLabelKeys: Record<AITaskType, TranslationKey> = {
  [AITaskType.Summary]: 'tasks.taskType.summary',
  [AITaskType.Translation]: 'tasks.taskType.translation',
  [AITaskType.TranslationBatch]: 'tasks.taskType.translationBatch',
  [AITaskType.TranslationAll]: 'tasks.taskType.translationAll',
  [AITaskType.SlugBackfill]: 'tasks.taskType.slugBackfill',
  [AITaskType.Insights]: 'tasks.taskType.insights',
  [AITaskType.InsightsTranslation]: 'tasks.taskType.insightsTranslation',
}

export const taskStatusLabelKeys: Record<AITaskStatus, TranslationKey> = {
  [AITaskStatus.Pending]: 'tasks.taskStatus.pending',
  [AITaskStatus.Running]: 'tasks.taskStatus.running',
  [AITaskStatus.Completed]: 'tasks.taskStatus.completed',
  [AITaskStatus.PartialFailed]: 'tasks.taskStatus.partialFailed',
  [AITaskStatus.Failed]: 'tasks.taskStatus.failed',
  [AITaskStatus.Cancelled]: 'tasks.taskStatus.cancelled',
}

export const statusIcon: Record<AITaskStatus, LucideIcon> = {
  [AITaskStatus.Pending]: Clock,
  [AITaskStatus.Running]: Loader2,
  [AITaskStatus.Completed]: CheckCircle2,
  [AITaskStatus.PartialFailed]: AlertTriangle,
  [AITaskStatus.Failed]: AlertCircle,
  [AITaskStatus.Cancelled]: XCircle,
}

export type TaskStatusCategory = 'active' | 'cancelled' | 'completed' | 'failed'

export const statusCategoryStatuses: Record<
  TaskStatusCategory,
  AITaskStatus[]
> = {
  active: [AITaskStatus.Pending, AITaskStatus.Running],
  cancelled: [AITaskStatus.Cancelled],
  completed: [AITaskStatus.Completed],
  failed: [AITaskStatus.Failed, AITaskStatus.PartialFailed],
}

export const statusCategoryOptionKeys: Array<{
  labelKey: TranslationKey
  value: TaskStatusCategory | ''
}> = [
  { labelKey: 'tasks.filter.allStatus', value: '' },
  { labelKey: 'tasks.statusCategory.active', value: 'active' },
  { labelKey: 'tasks.statusCategory.failed', value: 'failed' },
  { labelKey: 'tasks.statusCategory.completed', value: 'completed' },
  { labelKey: 'tasks.statusCategory.cancelled', value: 'cancelled' },
]

export const typeOptionKeys: Array<{
  labelKey: TranslationKey
  value: AITaskType | ''
}> = [
  { labelKey: 'tasks.filter.allType', value: '' },
  { labelKey: 'tasks.taskType.summary', value: AITaskType.Summary },
  { labelKey: 'tasks.taskType.translation', value: AITaskType.Translation },
  {
    labelKey: 'tasks.taskType.translationBatch',
    value: AITaskType.TranslationBatch,
  },
  {
    labelKey: 'tasks.taskType.translationAll',
    value: AITaskType.TranslationAll,
  },
  { labelKey: 'tasks.taskType.slugBackfill', value: AITaskType.SlugBackfill },
  { labelKey: 'tasks.taskType.insights', value: AITaskType.Insights },
  {
    labelKey: 'tasks.taskType.insightsTranslation',
    value: AITaskType.InsightsTranslation,
  },
]

export const scopeOptionKeys: Array<{
  labelKey: TranslationKey
  value: TaskScope | ''
}> = [
  { labelKey: 'tasks.filter.allScope', value: '' },
  { labelKey: 'tasks.scope.ai', value: 'ai' },
  { labelKey: 'tasks.scope.enrichment', value: 'enrichment' },
  { labelKey: 'tasks.scope.cron', value: 'cron' },
]

export const scopeLabelKeys: Record<TaskScope, TranslationKey> = {
  ai: 'tasks.scope.ai',
  enrichment: 'tasks.scope.enrichment',
  cron: 'tasks.scope.cron',
}
