import { Hash, Plus, Trash2 } from 'lucide-react'
import { useCallback, useMemo, useRef } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router'

import { APP_SHELL_HEADER_HEIGHT_CLASS } from '~/constants/layout'
import { useI18n } from '~/i18n'
import type { TopicModel } from '~/models/topic'
import { CompactPagination } from '~/ui/data/compact-pagination'
import { confirmDialog } from '~/ui/feedback/confirm'
import { FocusScope } from '~/ui/focus-scope'
import { MasterDetailShell } from '~/ui/layout/master-detail-shell'
import { MobileHeaderAffordance } from '~/ui/layout/mobile-header-affordance'
import { useListKeyboard } from '~/ui/list-actions'
import { Button } from '~/ui/primitives/button'
import { Checkbox } from '~/ui/primitives/checkbox'
import { Scroll } from '~/ui/primitives/scroll'
import { cn } from '~/utils/cn'

import { topicPageSize } from '../constants'
import { useTopicMutations } from '../hooks/use-topic-mutations'
import { useTopicsList } from '../hooks/use-topics-list'
import type { TopicFormMode } from '../types/topics'
import { buildTopicActions } from './buildTopicActions'
import { ListEmpty } from './ListEmpty'
import { ListError } from './ListError'
import { TopicDetailEmpty } from './TopicDetailEmpty'
import { presentTopicForm } from './TopicFormModal'
import { TopicListSkeleton } from './TopicListSkeleton'
import { TopicRow } from './TopicRow'
import { TopicsRouteContext } from './topics-route-context'

const FOCUS_SCOPE_ID = 'topics-list'

export function TopicsRouteViewContent() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const params = useParams<{ id?: string }>()
  const detailId = params.id ?? ''
  const [searchParams] = useSearchParams()
  const { page, pagination, setPage, topics, topicsQuery } = useTopicsList()

  const selectionClearRef = useRef<(() => void) | null>(null)

  const closeDetail = useCallback(() => {
    const qs = searchParams.toString()
    navigate(`/notes/topic${qs ? `?${qs}` : ''}`)
  }, [navigate, searchParams])

  const { batchDeleteMutation, deleteMutation, invalidateTopics } =
    useTopicMutations({
      onAfterDeleteSuccess: () => {
        selectionClearRef.current?.()
        closeDetail()
      },
    })

  const openTopic = useCallback(
    (topic: TopicModel) => {
      const qs = searchParams.toString()
      navigate(`/notes/topic/${topic.id}${qs ? `?${qs}` : ''}`)
    },
    [navigate, searchParams],
  )

  const openForm = useCallback(
    async (mode: TopicFormMode) => {
      const topic = await presentTopicForm(mode)
      if (topic) {
        const qs = searchParams.toString()
        navigate(`/notes/topic/${topic.id}${qs ? `?${qs}` : ''}`)
        await invalidateTopics()
      }
    },
    [invalidateTopics, navigate, searchParams],
  )

  const confirmAndDelete = useCallback(
    async (targets: TopicModel[]) => {
      if (targets.length === 0) return
      const title =
        targets.length === 1
          ? t('topics.detail.confirmDelete', { name: targets[0].name })
          : t('topics.list.confirmBatchDelete', { count: targets.length })
      const confirmed = await confirmDialog({ destructive: true, title })
      if (!confirmed) return
      if (targets.length === 1) {
        deleteMutation.mutate(targets[0].id)
      } else {
        batchDeleteMutation.mutate(targets.map((target) => target.id))
      }
    },
    [batchDeleteMutation, deleteMutation, t],
  )

  const actions = useMemo(
    () =>
      buildTopicActions(
        {
          deleteMany: confirmAndDelete,
          open: openTopic,
        },
        t,
      ),
    [confirmAndDelete, openTopic, t],
  )

  const { selection } = useListKeyboard<TopicModel>({
    actions,
    getId: (topic) => topic.id,
    items: topics,
    onItemFocus: (id) => {
      const topic = topics.find((entry) => entry.id === id)
      if (topic) openTopic(topic)
    },
    resetOn: [page],
    scopeId: FOCUS_SCOPE_ID,
  })
  selectionClearRef.current = selection.clear

  const selectedCount = selection.size
  const visibleIds = topics.map((t) => t.id)
  const allVisibleSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selection.isSelected(id))
  const indeterminate = selectedCount > 0 && !allVisibleSelected

  const routeContextValue = useMemo(
    () => ({
      deleting: deleteMutation.isPending,
      onBack: closeDetail,
      onDelete: (topic: TopicModel) => {
        void confirmAndDelete([topic])
      },
      onEdit: (topic: TopicModel) => {
        void openForm({ id: topic.id, kind: 'edit' })
      },
    }),
    [closeDetail, confirmAndDelete, deleteMutation.isPending, openForm],
  )

  return (
    <TopicsRouteContext.Provider value={routeContextValue}>
      <MasterDetailShell
        detailScopeId={`${FOCUS_SCOPE_ID}-detail`}
        emptyDetail={<TopicDetailEmpty />}
        list={
          <FocusScope
            className="outline-hidden flex h-full min-h-0 flex-col"
            id={FOCUS_SCOPE_ID}
          >
            <div
              className={cn(
                'flex shrink-0 items-center justify-between border-b border-neutral-200 px-4 dark:border-neutral-800',
                APP_SHELL_HEADER_HEIGHT_CLASS,
              )}
            >
              <div className="flex min-w-0 items-center gap-2">
                <MobileHeaderAffordance />
                <h2 className="inline-flex items-center gap-2 text-lg font-semibold">
                  <Hash aria-hidden="true" className="size-4" />
                  {t('topics.list.title')}
                </h2>
              </div>
              <span className="text-xs text-neutral-500 dark:text-neutral-400">
                {pagination
                  ? t('topics.list.count', { count: pagination.total })
                  : t('common.loading')}
              </span>
              <Button
                onClick={() => void openForm({ kind: 'create' })}
                type="button"
                variant="subtle"
              >
                <Plus aria-hidden="true" className="size-4" />
                {t('topics.list.new')}
              </Button>
            </div>

            {topics.length > 0 ? (
              <div className="flex h-9 shrink-0 items-center gap-2 border-b border-neutral-200 bg-neutral-50/60 px-4 text-xs dark:border-neutral-800 dark:bg-neutral-900/40">
                <Checkbox
                  aria-label={t('topics.list.selectAllVisible')}
                  checked={allVisibleSelected}
                  indeterminate={indeterminate}
                  onCheckedChange={(checked) => {
                    if (checked) selection.selectAll()
                    else selection.clear()
                  }}
                />
                <span className="text-neutral-500 dark:text-neutral-400">
                  {selectedCount > 0
                    ? t('topics.list.selectedCount', { count: selectedCount })
                    : t('topics.list.selectAllVisible')}
                </span>
                <button
                  aria-hidden={selectedCount === 0}
                  className={cn(
                    'ml-auto inline-flex h-6 items-center gap-1 rounded px-2 text-xs text-red-600 transition-colors hover:bg-red-50 disabled:pointer-events-none disabled:opacity-50 dark:text-red-400 dark:hover:bg-red-950/40',
                    selectedCount === 0 && 'pointer-events-none invisible',
                  )}
                  disabled={
                    selectedCount === 0 || batchDeleteMutation.isPending
                  }
                  onClick={() =>
                    void confirmAndDelete(selection.getSelectedTargets())
                  }
                  tabIndex={selectedCount === 0 ? -1 : undefined}
                  type="button"
                >
                  <Trash2 aria-hidden="true" className="size-3.5" />
                  {t('topics.list.bulkDelete')}
                </button>
              </div>
            ) : null}

            <Scroll className="flex-1">
              {topicsQuery.isLoading && topics.length === 0 ? (
                <TopicListSkeleton />
              ) : topicsQuery.isError ? (
                <ListError onRetry={() => void topicsQuery.refetch()} />
              ) : topics.length === 0 ? (
                <ListEmpty onCreate={() => void openForm({ kind: 'create' })} />
              ) : (
                topics.map((topic) => (
                  <TopicRow
                    actions={actions}
                    checked={selection.isSelected(topic.id)}
                    cursor={selection.isCursor(topic.id)}
                    isDetailTarget={detailId === topic.id}
                    key={topic.id}
                    onCheck={() => selection.toggleWithAnchor(topic.id)}
                    onSelect={(mode) => {
                      if (mode === 'range') selection.selectRange(topic.id)
                      else if (mode === 'toggle')
                        selection.toggleWithAnchor(topic.id)
                      else {
                        selection.setCursor(topic.id)
                        openTopic(topic)
                      }
                    }}
                    selected={selection.isSelected(topic.id)}
                    topic={topic}
                  />
                ))
              )}
            </Scroll>

            {pagination && pagination.totalPages > 1 ? (
              <div className="flex shrink-0 items-center justify-between gap-3 border-t border-neutral-200 px-4 py-3 dark:border-neutral-800">
                <span className="text-xs tabular-nums text-neutral-500 dark:text-neutral-400">
                  {t('topics.notes.pageIndicator', { page: pagination.page })}
                </span>
                <CompactPagination
                  onPageChange={setPage}
                  onPageSizeChange={() => undefined}
                  page={page}
                  pageCount={pagination.totalPages}
                  pageSize={topicPageSize}
                  pageSizes={[topicPageSize]}
                />
              </div>
            ) : null}
          </FocusScope>
        }
      />
    </TopicsRouteContext.Provider>
  )
}
