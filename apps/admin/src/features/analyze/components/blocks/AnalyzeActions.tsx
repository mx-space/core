import {
  useIsFetching,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query'
import { Loader2, RefreshCw, Table2, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import { deleteAllAnalyzeRecords } from '~/api/analyze'
import { useI18n } from '~/i18n'
import { Button } from '~/ui/primitives/button'
import { SegmentedControl } from '~/ui/primitives/segmented-control'
import { cn } from '~/utils/cn'

import { analyzeQueryKey } from '../../constants'
import type { TimeRange } from '../../types/analyze'
import { getErrorMessage } from '../../utils/analyze'

export function AnalyzeActions(props: {
  onOpenRecords: () => void
  onRangeChange: (next: TimeRange) => void
  range: TimeRange
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
    <div className="flex flex-wrap items-center gap-2">
      <SegmentedControl
        aria-label={t('analyze.trend.title')}
        onValueChange={props.onRangeChange}
        options={[
          { label: t('analyze.timeRange.today'), value: 'today' },
          { label: t('analyze.timeRange.week'), value: '7d' },
          { label: t('analyze.timeRange.month'), value: '30d' },
        ]}
        value={props.range}
      />
      <Button
        className="text-xs"
        onClick={props.onOpenRecords}
        type="button"
        variant="subtle"
      >
        <Table2 aria-hidden="true" className="size-3.5" />
        {t('analyze.records.title')}
      </Button>
      <Button
        className="text-xs"
        disabled={isAnyFetching}
        onClick={() => {
          void queryClient.invalidateQueries({ queryKey: analyzeQueryKey })
        }}
        type="button"
        variant="subtle"
      >
        <RefreshCw
          aria-hidden="true"
          className={cn('size-3.5', isAnyFetching && 'animate-spin')}
        />
        {t('analyze.action.refresh')}
      </Button>
      <Button
        className="border-red-200 text-xs text-red-600 hover:bg-red-50 dark:border-red-950 dark:text-red-400 dark:hover:bg-red-950/30"
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
          <Loader2 aria-hidden="true" className="size-3.5 animate-spin" />
        ) : (
          <Trash2 aria-hidden="true" className="size-3.5" />
        )}
        {t('analyze.action.clear')}
      </Button>
    </div>
  )
}
