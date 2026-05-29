import {
  useIsFetching,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query'
import { Loader2, RefreshCw, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import type { TimeRange } from '../../types/analyze'

import { deleteAllAnalyzeRecords } from '~/api/analyze'
import { useI18n } from '~/i18n'
import { Button } from '~/ui/primitives/button'
import { cn } from '~/utils/cn'

import { analyzeQueryKey } from '../../constants'
import { getErrorMessage } from '../../utils/analyze'

export function AnalyzeActions(props: {
  range: TimeRange
  onRangeChange: (next: TimeRange) => void
}) {
  const { t } = useI18n()
  const queryClient = useQueryClient()
  const fetchingCount = useIsFetching({ queryKey: analyzeQueryKey })
  const isAnyFetching = fetchingCount > 0

  const deleteMutation = useMutation({
    mutationFn: deleteAllAnalyzeRecords,
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, t('analyze.delete.failed')))
    },
    onSuccess: async () => {
      toast.success(t('analyze.delete.success'))
      await queryClient.invalidateQueries({ queryKey: analyzeQueryKey })
    },
  })

  return (
    <div className="flex items-center gap-2">
      <div className="flex rounded border border-neutral-200 bg-white p-0.5 dark:border-neutral-800 dark:bg-neutral-950">
        {(
          [
            ['today', t('analyze.timeRange.today')],
            ['7d', t('analyze.timeRange.week')],
            ['30d', t('analyze.timeRange.month')],
          ] as const
        ).map(([value, label]) => (
          <button
            className={cn(
              'h-8 rounded px-3 text-xs font-medium text-neutral-500 transition-colors hover:text-neutral-950 dark:text-neutral-400 dark:hover:text-neutral-50',
              props.range === value &&
                'bg-neutral-950 text-white hover:text-white dark:bg-neutral-50 dark:text-neutral-950 dark:hover:text-neutral-950',
            )}
            key={value}
            onClick={() => props.onRangeChange(value)}
            type="button"
          >
            {label}
          </button>
        ))}
      </div>
      <Button
        disabled={isAnyFetching}
        onClick={() => {
          void queryClient.invalidateQueries({ queryKey: analyzeQueryKey })
        }}
        type="button"
        variant="subtle"
      >
        <RefreshCw
          aria-hidden="true"
          className={cn('size-4', isAnyFetching && 'animate-spin')}
        />
        {t('analyze.action.refresh')}
      </Button>
      <Button
        className="border-red-200 text-red-600 hover:bg-red-50 dark:border-red-950 dark:text-red-400 dark:hover:bg-red-950/30"
        disabled={deleteMutation.isPending}
        onClick={() => {
          if (window.confirm(t('analyze.confirm.clearAll'))) {
            deleteMutation.mutate()
          }
        }}
        type="button"
        variant="subtle"
      >
        {deleteMutation.isPending ? (
          <Loader2 aria-hidden="true" className="size-4 animate-spin" />
        ) : (
          <Trash2 aria-hidden="true" className="size-4" />
        )}
        {t('analyze.action.clear')}
      </Button>
    </div>
  )
}
