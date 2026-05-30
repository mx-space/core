import { X } from 'lucide-react'

import { AITaskStatus } from '~/api/ai'
import { useI18n } from '~/i18n'
import { cn } from '~/utils/cn'

interface TaskFilterChipsProps {
  status: AITaskStatus | ''
  onStatusChange: (status: AITaskStatus | '') => void
}

const statusChips: Array<{
  value: AITaskStatus | ''
  labelKey:
    | 'ai.filter.allStatus'
    | 'ai.taskStatus.cancelled'
    | 'ai.taskStatus.completed'
    | 'ai.taskStatus.failed'
    | 'ai.taskStatus.partialFailed'
    | 'ai.taskStatus.pending'
    | 'ai.taskStatus.running'
}> = [
  { value: '', labelKey: 'ai.filter.allStatus' },
  { value: AITaskStatus.Pending, labelKey: 'ai.taskStatus.pending' },
  { value: AITaskStatus.Running, labelKey: 'ai.taskStatus.running' },
  { value: AITaskStatus.Completed, labelKey: 'ai.taskStatus.completed' },
  { value: AITaskStatus.Failed, labelKey: 'ai.taskStatus.failed' },
  {
    value: AITaskStatus.PartialFailed,
    labelKey: 'ai.taskStatus.partialFailed',
  },
  { value: AITaskStatus.Cancelled, labelKey: 'ai.taskStatus.cancelled' },
]

export function TaskFilterChips(props: TaskFilterChipsProps) {
  const { t } = useI18n()

  return (
    <div className="-mx-1 flex shrink-0 items-center gap-1 overflow-x-auto border-b border-border px-4 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {statusChips.map((chip) => {
        const active = props.status === chip.value
        const label = t(chip.labelKey)
        return (
          <button
            aria-label={t('ai.tasks.filter.statusChipAria', { label })}
            aria-pressed={active}
            className={cn(
              'inline-flex h-7 shrink-0 items-center gap-1 rounded-full border px-2.5 text-xs font-medium transition-colors',
              active
                ? 'border-fg bg-fg text-white dark:bg-surface-inset dark:text-fg'
                : 'border-border bg-surface-card text-fg hover:bg-surface-inset',
            )}
            key={chip.value || '__all'}
            onClick={() => {
              if (active && chip.value !== '') {
                props.onStatusChange('')
              } else {
                props.onStatusChange(chip.value)
              }
            }}
            type="button"
          >
            <span>{label}</span>
            {active && chip.value !== '' ? (
              <X aria-hidden="true" className="size-3" />
            ) : null}
          </button>
        )
      })}
    </div>
  )
}
