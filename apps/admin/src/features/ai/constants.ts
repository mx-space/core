import type { LucideIcon } from 'lucide-react'
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Loader2,
  XCircle,
} from 'lucide-react'

import { AITaskStatus, AITaskType } from '~/api/ai'
import type { TranslationKey } from '~/i18n/types'
import { adminQueryKeys } from '~/query/keys'

export const aiTasksQueryKey = adminQueryKeys.ai.tasksRoot

export const pageSize = 50
export const groupedPageSize = 20

export const liveSubscribeIntervalMs = 30_000
export const fallbackPollingIntervalMs = 5_000

export const taskTypeLabelKeys: Record<AITaskType, TranslationKey> = {
  [AITaskType.Summary]: 'ai.taskType.summary',
  [AITaskType.Translation]: 'ai.taskType.translation',
  [AITaskType.TranslationBatch]: 'ai.taskType.translationBatch',
  [AITaskType.TranslationAll]: 'ai.taskType.translationAll',
  [AITaskType.SlugBackfill]: 'ai.taskType.slugBackfill',
  [AITaskType.Insights]: 'ai.taskType.insights',
  [AITaskType.InsightsTranslation]: 'ai.taskType.insightsTranslation',
}

export const taskStatusLabelKeys: Record<AITaskStatus, TranslationKey> = {
  [AITaskStatus.Pending]: 'ai.taskStatus.pending',
  [AITaskStatus.Running]: 'ai.taskStatus.running',
  [AITaskStatus.Completed]: 'ai.taskStatus.completed',
  [AITaskStatus.PartialFailed]: 'ai.taskStatus.partialFailed',
  [AITaskStatus.Failed]: 'ai.taskStatus.failed',
  [AITaskStatus.Cancelled]: 'ai.taskStatus.cancelled',
}

export const statusIcon: Record<AITaskStatus, LucideIcon> = {
  [AITaskStatus.Pending]: Clock,
  [AITaskStatus.Running]: Loader2,
  [AITaskStatus.Completed]: CheckCircle2,
  [AITaskStatus.PartialFailed]: AlertTriangle,
  [AITaskStatus.Failed]: AlertCircle,
  [AITaskStatus.Cancelled]: XCircle,
}

export const statusOptionKeys: Array<{
  labelKey: TranslationKey
  value: AITaskStatus | ''
}> = [
  { labelKey: 'ai.filter.allStatus', value: '' },
  { labelKey: 'ai.taskStatus.pending', value: AITaskStatus.Pending },
  { labelKey: 'ai.taskStatus.running', value: AITaskStatus.Running },
  { labelKey: 'ai.taskStatus.completed', value: AITaskStatus.Completed },
  {
    labelKey: 'ai.taskStatus.partialFailed',
    value: AITaskStatus.PartialFailed,
  },
  { labelKey: 'ai.taskStatus.failed', value: AITaskStatus.Failed },
  { labelKey: 'ai.taskStatus.cancelled', value: AITaskStatus.Cancelled },
]

export const typeOptionKeys: Array<{
  labelKey: TranslationKey
  value: AITaskType | ''
}> = [
  { labelKey: 'ai.filter.allType', value: '' },
  { labelKey: 'ai.taskType.summary', value: AITaskType.Summary },
  { labelKey: 'ai.taskType.translation', value: AITaskType.Translation },
  {
    labelKey: 'ai.taskType.translationBatch',
    value: AITaskType.TranslationBatch,
  },
  { labelKey: 'ai.taskType.translationAll', value: AITaskType.TranslationAll },
  { labelKey: 'ai.taskType.slugBackfill', value: AITaskType.SlugBackfill },
  { labelKey: 'ai.taskType.insights', value: AITaskType.Insights },
  {
    labelKey: 'ai.taskType.insightsTranslation',
    value: AITaskType.InsightsTranslation,
  },
]

export const translationEntryKeyPathOptions = [
  'category.name',
  'topic.name',
  'topic.introduce',
  'note.mood',
  'note.weather',
] as const
