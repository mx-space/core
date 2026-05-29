import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCheck, MessageSquare, ShieldAlert, Trash2 } from 'lucide-react'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router'
import { toast } from 'sonner'
import type { CommentModel } from '~/models/comment'

import {
  batchDeleteComments,
  batchUpdateCommentState,
  deleteComment,
  getComments,
  replyComment,
  updateCommentState,
} from '~/api/comments'
import { APP_SHELL_HEADER_HEIGHT_CLASS } from '~/constants/layout'
import { useI18n } from '~/i18n'
import { CommentState } from '~/models/comment'
import { confirmDialog } from '~/ui/feedback/confirm'
import { FocusScope } from '~/ui/focus-scope'
import { MasterDetailLayout } from '~/ui/layout/page-layout'
import { useListKeyboard } from '~/ui/list-actions'
import { Button } from '~/ui/primitives/button'
import { Checkbox } from '~/ui/primitives/checkbox'
import { Scroll } from '~/ui/primitives/scroll'
import { SelectField } from '~/ui/primitives/select'
import { cn } from '~/utils/cn'

import {
  commentsPageSize,
  commentsQueryKey,
  getCommentFilters,
} from '../constants'
import { normalizeCommentState, readCommentPage } from '../utils/comments'
import { buildCommentActions } from './buildCommentActions'
import { CommentDetail } from './CommentDetail'
import { CommentListItem } from './CommentListItem'
import { CommentEmptyState } from './CommentPrimitives'

const FOCUS_SCOPE_ID = 'comments-list'

export function CommentsRouteViewContent() {
  const { locale, t } = useI18n()
  const queryClient = useQueryClient()
  const commentFilters = useMemo(() => getCommentFilters(), [locale])
  const [searchParams, setSearchParams] = useSearchParams()
  const searchParamsKey = searchParams.toString()
  const [state, setState] = useState(() =>
    normalizeCommentState(searchParams.get('state')),
  )
  const [page, setPage] = useState(() =>
    readCommentPage(searchParams.get('page')),
  )
  const [detailId, setDetailId] = useState<string | null>(
    searchParams.get('id'),
  )
  const [selectedCommentSnapshot, setSelectedCommentSnapshot] =
    useState<CommentModel | null>(null)
  const [showDetailOnMobile, setShowDetailOnMobile] = useState(
    Boolean(searchParams.get('id')),
  )
  const [selectAllMode, setSelectAllMode] = useState(false)

  const commentsQuery = useQuery({
    placeholderData: (previous) => previous,
    queryFn: () => getComments({ page, size: commentsPageSize, state }),
    queryKey: [...commentsQueryKey, 'list', state, page, commentsPageSize],
  })

  const comments = commentsQuery.data?.data ?? []
  const pagination = commentsQuery.data?.pagination
  const selectedComment =
    comments.find((comment) => comment.id === detailId) ??
    (selectedCommentSnapshot?.id === detailId ? selectedCommentSnapshot : null)

  useLayoutEffect(() => {
    const nextState = normalizeCommentState(searchParams.get('state'))
    const nextPage = readCommentPage(searchParams.get('page'))
    const nextDetailId = searchParams.get('id')

    setState((value) => (value === nextState ? value : nextState))
    setPage((value) => (value === nextPage ? value : nextPage))
    setDetailId((value) => (value === nextDetailId ? value : nextDetailId))
    setShowDetailOnMobile(Boolean(nextDetailId))
    setSelectAllMode(false)
    if (!nextDetailId) setSelectedCommentSnapshot(null)
  }, [searchParamsKey])

  useEffect(() => {
    const next = new URLSearchParams()
    next.set('state', String(state))
    if (page > 1) next.set('page', String(page))
    if (detailId) next.set('id', detailId)
    if (next.toString() !== searchParamsKey) {
      setSearchParams(next, { replace: true })
    }
  }, [page, searchParamsKey, detailId, setSearchParams, state])

  const selectionClearRef = useRef<(() => void) | null>(null)
  // Batch mutations close over this ref so they can read the latest selection
  // without depending on selection identity (which is created later, after
  // `actions`). Updated immediately after useListKeyboard returns.
  const selectionTargetsRef = useRef<CommentModel[]>([])

  const invalidateComments = async () => {
    await queryClient.invalidateQueries({ queryKey: commentsQueryKey })
  }

  const stateMutation = useMutation({
    mutationFn: ({ id, nextState }: { id: string; nextState: CommentState }) =>
      updateCommentState(id, nextState),
    onSuccess: async () => {
      toast.success(t('comments.toast.updated'))
      await invalidateComments()
    },
  })

  const deleteMutation = useMutation({
    mutationFn: deleteComment,
    onSuccess: async () => {
      toast.success(t('comments.toast.deleted'))
      setDetailId(null)
      setSelectedCommentSnapshot(null)
      setShowDetailOnMobile(false)
      selectionClearRef.current?.()
      await invalidateComments()
    },
  })

  const batchStateMutation = useMutation({
    mutationFn: (nextState: CommentState) => {
      if (selectAllMode) {
        return batchUpdateCommentState({
          all: true,
          currentState: state,
          state: nextState,
        })
      }
      const ids = selectionTargetsRef.current.map((c) => c.id)
      return batchUpdateCommentState({ ids, state: nextState })
    },
    onSuccess: async () => {
      toast.success(t('comments.toast.updated'))
      selectionClearRef.current?.()
      await invalidateComments()
    },
  })

  const batchDeleteMutation = useMutation({
    mutationFn: () => {
      if (selectAllMode) {
        return batchDeleteComments({ all: true, state })
      }
      const ids = selectionTargetsRef.current.map((c) => c.id)
      return batchDeleteComments({ ids })
    },
    onSuccess: async () => {
      toast.success(t('comments.toast.deleted'))
      selectionClearRef.current?.()
      setDetailId(null)
      setSelectedCommentSnapshot(null)
      setShowDetailOnMobile(false)
      await invalidateComments()
    },
  })

  const replyMutation = useMutation({
    mutationFn: ({ id, text }: { id: string; text: string }) =>
      replyComment(id, text),
    onSuccess: async () => {
      toast.success(t('comments.toast.replied'))
      await invalidateComments()
    },
  })

  const openComment = (comment: CommentModel) => {
    setDetailId(comment.id)
    setSelectedCommentSnapshot({ ...comment })
    setShowDetailOnMobile(true)
  }

  const confirmDeleteComments = async (targets: CommentModel[]) => {
    if (targets.length === 0) return
    const description =
      targets.length === 1
        ? t('comments.confirmDelete.single')
        : t('comments.confirmDelete.batch', { count: targets.length })
    const confirmed = await confirmDialog({
      description,
      destructive: true,
      title: t('common.confirmDelete'),
    })
    if (!confirmed) return
    if (targets.length === 1) {
      deleteMutation.mutate(targets[0].id)
    } else {
      batchDeleteMutation.mutate()
    }
  }

  const actions = useMemo(
    () =>
      buildCommentActions(
        {
          deleteMany: confirmDeleteComments,
          open: openComment,
        },
        t,
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t],
  )

  const { selection } = useListKeyboard<CommentModel>({
    actions,
    getId: (comment) => comment.id,
    items: comments,
    onBeforeSelectionReset: () => setSelectAllMode(false),
    resetOn: [state, page],
    scopeId: FOCUS_SCOPE_ID,
  })
  selectionClearRef.current = selection.clear
  selectionTargetsRef.current = selection.getSelectedTargets()

  const changeFilter = (nextState: CommentState) => {
    setState(nextState)
    setPage(1)
    setDetailId(null)
    setSelectedCommentSnapshot(null)
    setShowDetailOnMobile(false)
  }

  const selectedCount = selectAllMode
    ? (pagination?.total ?? 0)
    : selection.size
  const hasSelection = selectedCount > 0
  const allVisibleSelected =
    comments.length > 0 &&
    comments.every((comment) => selection.isSelected(comment.id))
  const indeterminate = selection.size > 0 && !allVisibleSelected

  const confirmBatchDelete = () => {
    if (!hasSelection) return
    void (async () => {
      const confirmed = await confirmDialog({
        description: t('comments.confirmDelete.batch', {
          count: selectedCount,
        }),
        destructive: true,
        title: t('common.confirmDelete'),
      })
      if (!confirmed) return
      batchDeleteMutation.mutate()
    })()
  }

  return (
    <MasterDetailLayout
      showDetailOnMobile={showDetailOnMobile}
      list={
        <FocusScope
          className="outline-hidden flex h-full min-h-0 flex-col"
          id={FOCUS_SCOPE_ID}
        >
          <div
            className={cn(
              'flex shrink-0 items-center justify-between gap-3 border-b border-neutral-200 px-4 dark:border-neutral-800',
              APP_SHELL_HEADER_HEIGHT_CLASS,
            )}
          >
            <div className="flex items-center gap-2">
              <MessageSquare aria-hidden="true" className="size-4" />
              <SelectField
                aria-label={t('comments.filter.label')}
                options={commentFilters}
                onValueChange={changeFilter}
                triggerClassName="h-auto border-0 bg-transparent px-0 text-sm font-medium hover:bg-transparent dark:bg-transparent dark:hover:bg-transparent"
                value={state}
              />
            </div>
            <span className="text-xs text-neutral-400">
              {pagination
                ? t('comments.list.totalCount', { count: pagination.total })
                : 'Comments'}
            </span>
          </div>

          {comments.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2 border-b border-neutral-200 bg-neutral-50 px-4 py-2 text-sm dark:border-neutral-800 dark:bg-neutral-900/40">
              <Checkbox
                aria-label={t('comments.list.selectPage')}
                checked={allVisibleSelected}
                indeterminate={indeterminate}
                onCheckedChange={(checked) => {
                  if (checked) selection.selectAll()
                  else selection.clear()
                }}
              />
              <span className="text-neutral-500 dark:text-neutral-400">
                {hasSelection
                  ? t('comments.list.selectedCount', { count: selectedCount })
                  : t('comments.list.selectAll')}
              </span>
              {allVisibleSelected &&
              pagination &&
              pagination.totalPages > 1 &&
              !selectAllMode ? (
                <button
                  className="text-sm text-blue-600 hover:underline dark:text-blue-400"
                  onClick={() => setSelectAllMode(true)}
                  type="button"
                >
                  {t('comments.list.selectAllCount', {
                    count: pagination.total,
                  })}
                </button>
              ) : null}
            </div>
          ) : null}

          <Scroll className="flex-1">
            {commentsQuery.isLoading && comments.length === 0 ? (
              <div className="flex justify-center py-20">
                <div className="size-6 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-950 dark:border-neutral-700 dark:border-t-neutral-100" />
              </div>
            ) : comments.length === 0 ? (
              <CommentEmptyState />
            ) : (
              comments.map((comment) => (
                <CommentListItem
                  actions={actions}
                  checked={selection.isSelected(comment.id)}
                  comment={comment}
                  currentFilter={state}
                  isDetailTarget={detailId === comment.id}
                  key={comment.id}
                  onCheck={() => selection.toggleWithAnchor(comment.id)}
                  onMarkJunk={(id) =>
                    stateMutation.mutate({ id, nextState: CommentState.Junk })
                  }
                  onMarkRead={(id) =>
                    stateMutation.mutate({ id, nextState: CommentState.Read })
                  }
                  onSelect={(mode) => {
                    if (mode === 'range') selection.selectRange(comment.id)
                    else if (mode === 'toggle')
                      selection.toggleWithAnchor(comment.id)
                    else {
                      selection.selectOne(comment.id)
                      openComment(comment)
                    }
                  }}
                  selected={selection.isSelected(comment.id)}
                />
              ))
            )}
          </Scroll>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-neutral-200 px-4 py-3 dark:border-neutral-800">
            <div className="flex gap-2">
              <Button
                className="h-8 px-2"
                disabled={!hasSelection || state === CommentState.Read}
                onClick={() => batchStateMutation.mutate(CommentState.Read)}
                type="button"
                variant="subtle"
              >
                <CheckCheck aria-hidden="true" className="size-3.5" />
                {t('comments.action.markRead')}
              </Button>
              <Button
                className="h-8 px-2"
                disabled={!hasSelection || state === CommentState.Junk}
                onClick={() => batchStateMutation.mutate(CommentState.Junk)}
                type="button"
                variant="subtle"
              >
                <ShieldAlert aria-hidden="true" className="size-3.5" />
                {t('comments.action.markJunk')}
              </Button>
              <Button
                className="h-8 px-2 text-red-600 dark:text-red-400"
                disabled={!hasSelection}
                onClick={confirmBatchDelete}
                type="button"
                variant="subtle"
              >
                <Trash2 aria-hidden="true" className="size-3.5" />
                {t('common.delete')}
              </Button>
            </div>
            {pagination && pagination.totalPages > 1 ? (
              <div className="flex items-center gap-2 text-sm text-neutral-500 dark:text-neutral-400">
                <Button
                  className="h-8 px-2"
                  disabled={page <= 1}
                  onClick={() => {
                    setPage((current) => Math.max(1, current - 1))
                  }}
                  type="button"
                  variant="subtle"
                >
                  {t('common.pagination.previousPage')}
                </Button>
                <span>
                  {pagination.page} / {pagination.totalPages}
                </span>
                <Button
                  className="h-8 px-2"
                  disabled={page >= pagination.totalPages}
                  onClick={() => {
                    setPage((current) =>
                      Math.min(pagination.totalPages, current + 1),
                    )
                  }}
                  type="button"
                  variant="subtle"
                >
                  {t('common.pagination.nextPage')}
                </Button>
              </div>
            ) : null}
          </div>
        </FocusScope>
      }
      detail={
        <section className="h-full min-h-0">
          {selectedComment ? (
            <CommentDetail
              comment={selectedComment}
              currentState={state}
              onBack={() => setShowDetailOnMobile(false)}
              onDelete={(id) => {
                const target =
                  comments.find((c) => c.id === id) ?? selectedComment
                if (target) void confirmDeleteComments([target])
              }}
              onReply={(id, text) => replyMutation.mutateAsync({ id, text })}
              onStateChange={(id, nextState) =>
                stateMutation.mutate({ id, nextState })
              }
              replyPending={replyMutation.isPending}
            />
          ) : (
            <div className="flex h-full min-h-72 flex-col items-center justify-center text-center text-sm text-neutral-500 dark:text-neutral-400">
              <MessageSquare
                aria-hidden="true"
                className="mb-3 size-10 text-neutral-300 dark:text-neutral-700"
              />
              {t('comments.detail.empty')}
            </div>
          )}
        </section>
      }
    />
  )
}
