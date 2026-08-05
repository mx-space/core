import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AudioLines, RefreshCw, Sparkles } from 'lucide-react'
import { useEffect, useMemo } from 'react'
import { toast } from 'sonner'

import type { AITtsListRow } from '~/api/ai'
import { createTtsTask, deleteTts, getTtsList } from '~/api/ai'
import { useUrlListState } from '~/features/_shared/hooks/use-url-list-state'
import { useI18n } from '~/i18n'
import { adminQueryKeys } from '~/query/keys'
import { CompactPagination } from '~/ui/data/compact-pagination'
import { confirmDialog } from '~/ui/feedback/confirm'
import { FocusScope } from '~/ui/focus-scope'
import type { HeaderAction } from '~/ui/layout/page-layout'
import { PageHeader } from '~/ui/layout/page-layout'
import { useListSelection } from '~/ui/list-actions'
import { Checkbox } from '~/ui/primitives/checkbox'
import { Scroll } from '~/ui/primitives/scroll'

import {
  GroupedResourceSkeleton,
  ResourceEmpty,
  ResourceError,
} from '../components/GroupedResourceStates'
import {
  buildTtsRegeneratePayload,
  getErrorMessage,
  getTaskMutationMessage,
  summarizeTaskBatch,
} from '../utils/ai'
import { AiTtsTableRow } from './AiTtsTableRow'

const FOCUS_SCOPE_ID = 'ai-tts'
const PAGE_SIZE = 20

function readPositiveInt(value: null | string) {
  const n = Number(value)
  return Number.isInteger(n) && n > 0 ? n : 1
}

interface TtsUrlState {
  page: number
}

function writeTtsUrlState(state: TtsUrlState) {
  const next = new URLSearchParams()
  if (state.page > 1) next.set('page', String(state.page))
  return next
}

export function AiTtsRouteView() {
  const { t } = useI18n()
  const queryClient = useQueryClient()

  const urlStateOptions = useMemo(
    () => ({
      read: (searchParams: URLSearchParams): TtsUrlState => ({
        page: readPositiveInt(searchParams.get('page')),
      }),
      write: writeTtsUrlState,
    }),
    [],
  )
  const [urlState, setUrlState] = useUrlListState(urlStateOptions)
  const { page } = urlState
  const params = { page, size: PAGE_SIZE }

  const query = useQuery({
    placeholderData: (previous) => previous,
    queryFn: () => getTtsList(params),
    queryKey: adminQueryKeys.ai.ttsList(params),
  })

  const rows = query.data?.data ?? []
  const articles = query.data?.articles ?? {}
  const total = query.data?.pagination.total ?? rows.length
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const selection = useListSelection<AITtsListRow>({
    getId: (row) => row.id,
    items: rows,
  })
  // Classic (non-infinite) pagination replaces `rows` wholesale per page, so
  // a selection carried across a page change would silently drop from
  // getSelectedTargets() while `selection.size` kept counting it.
  useEffect(() => {
    selection.clear()
  }, [page])

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: adminQueryKeys.ai.ttsRoot })
    await queryClient.invalidateQueries({
      queryKey: adminQueryKeys.tasks.tasksRoot,
    })
  }

  const regenerateMutation = useMutation({
    mutationFn: (row: AITtsListRow) =>
      createTtsTask(buildTtsRegeneratePayload(row)),
    onError: (error: unknown) =>
      toast.error(getErrorMessage(error, t('ai.toast.taskCreateFailed'))),
    onSuccess: async (result) => {
      const message = getTaskMutationMessage(result, t)
      if (message) toast.success(message)
      await invalidate()
    },
  })

  const deleteMutation = useMutation({
    mutationFn: deleteTts,
    onError: (error: unknown) =>
      toast.error(getErrorMessage(error, t('ai.toast.deleteFailed'))),
    onSuccess: async () => {
      toast.success(t('ai.toast.deleted'))
      selection.clear()
      await invalidate()
    },
  })

  const batchRegenerateMutation = useMutation({
    mutationFn: async (targets: AITtsListRow[]) =>
      Promise.allSettled(
        targets.map((row) => createTtsTask(buildTtsRegeneratePayload(row))),
      ),
    onSuccess: async (results) => {
      const { deduped, queued, reasons } = summarizeTaskBatch(
        results,
        (error) => getErrorMessage(error, t('ai.toast.taskCreateFailed')),
      )

      if (reasons.length > 0) {
        toast.warning(
          t('ai.tts.toast.batchPartial', {
            failed: reasons.length,
            succeeded: queued,
          }),
          { description: reasons.join('\n') },
        )
      } else if (queued === 0) {
        toast.info(t('ai.tts.toast.batchAllExisting', { count: deduped }))
      } else if (deduped > 0) {
        toast.success(
          t('ai.tts.toast.batchQueuedPartly', { count: queued, deduped }),
        )
      } else {
        toast.success(t('ai.tts.toast.batchQueued', { count: queued }))
      }
      selection.clear()
      await invalidate()
    },
  })

  const confirmAndDelete = async (row: AITtsListRow) => {
    const ok = await confirmDialog({
      destructive: true,
      title: t('ai.confirm.deleteRecord'),
    })
    if (ok) deleteMutation.mutate(row.id)
  }

  const confirmAndBatchRegenerate = async () => {
    const targets = selection.getSelectedTargets()
    const ok = await confirmDialog({
      description: t('ai.tts.confirm.batchRegenerateHint'),
      title: t('ai.tts.confirm.batchRegenerate', { count: targets.length }),
    })
    if (ok) batchRegenerateMutation.mutate(targets)
  }

  const visibleIds = rows.map((row) => row.id)
  const allVisibleSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selection.isSelected(id))
  const indeterminate = selection.size > 0 && !allVisibleSelected

  const headerActions: HeaderAction[] = [
    {
      disabled: selection.size === 0 || batchRegenerateMutation.isPending,
      icon: Sparkles,
      kind: 'button',
      label: t('ai.tts.action.batchRegenerate'),
      onClick: () => void confirmAndBatchRegenerate(),
      primary: true,
    },
    {
      disabled: query.isFetching,
      icon: RefreshCw,
      iconOnly: true,
      kind: 'button',
      label: t('common.refresh'),
      onClick: () => void query.refetch(),
    },
  ]

  return (
    <FocusScope
      className="outline-hidden flex h-full min-h-0 flex-col bg-background"
      id={FOCUS_SCOPE_ID}
    >
      <PageHeader
        actions={headerActions}
        count={t('ai.tts.totalCount', { count: total })}
        icon={<AudioLines aria-hidden="true" className="size-4" />}
        title={t('routes.aiTts.title')}
      />

      <Scroll className="min-h-0 flex-1" orientation="both">
        {query.isLoading && rows.length === 0 ? (
          <GroupedResourceSkeleton />
        ) : query.isError ? (
          <ResourceError onRetry={() => void query.refetch()} />
        ) : rows.length === 0 ? (
          <ResourceEmpty label={t('ai.tab.tts')} />
        ) : (
          <table className="w-full min-w-[960px] text-sm">
            <thead className="border-b border-border text-left text-xs uppercase text-fg-muted">
              <tr>
                <th className="w-10 px-4 py-3">
                  <Checkbox
                    aria-label={t('ai.tts.selectAllLabel')}
                    checked={allVisibleSelected}
                    indeterminate={indeterminate}
                    onCheckedChange={(checked) => {
                      if (checked) selection.selectAll()
                      else selection.clear()
                    }}
                  />
                </th>
                <th className="px-4 py-3 font-medium">
                  {t('ai.tts.column.article')}
                </th>
                <th className="px-4 py-3 font-medium">
                  {t('ai.tts.column.lang')}
                </th>
                <th className="px-4 py-3 font-medium">
                  {t('ai.tts.column.blockCount')}
                </th>
                <th className="px-4 py-3 font-medium">
                  {t('ai.tts.column.charCount')}
                </th>
                <th className="px-4 py-3 font-medium">
                  {t('ai.tts.column.updatedAt')}
                </th>
                <th className="px-4 py-3 text-right font-medium">
                  {t('ai.tts.column.actions')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((row) => (
                <AiTtsTableRow
                  articleTitle={articles[row.refId]?.title ?? row.refId}
                  deletePending={deleteMutation.isPending}
                  key={row.id}
                  onDelete={() => void confirmAndDelete(row)}
                  onRegenerate={() => regenerateMutation.mutate(row)}
                  onToggleSelect={() => selection.toggle(row.id)}
                  regeneratePending={regenerateMutation.isPending}
                  row={row}
                  selected={selection.isSelected(row.id)}
                />
              ))}
            </tbody>
          </table>
        )}
      </Scroll>

      {pageCount > 1 ? (
        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-border px-4 py-3">
          <span className="text-xs tabular-nums text-fg-muted">
            {t('ai.page.pageIndex', { page })}
          </span>
          <CompactPagination
            onPageChange={(nextPage) => setUrlState({ page: nextPage })}
            onPageSizeChange={() => undefined}
            page={page}
            pageCount={pageCount}
            pageSize={PAGE_SIZE}
            pageSizes={[PAGE_SIZE]}
          />
        </div>
      ) : null}
    </FocusScope>
  )
}
