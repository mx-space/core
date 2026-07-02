import { useQuery } from '@tanstack/react-query'
import type { LucideIcon } from 'lucide-react'
import {
  CheckCheck,
  ChevronDown,
  Inbox,
  Loader2,
  Lock,
  MessageCircleReply,
  MessageSquare,
  ShieldAlert,
  X,
} from 'lucide-react'
import { useCallback, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router'

import type { CommentRefType } from '~/api/comments'
import { getCommentSourceCandidates } from '~/api/comments'
import { useI18n } from '~/i18n'
import type { TranslationKey } from '~/i18n/types'
import type { CommentModel, CommentTab } from '~/models/comment'
import { CommentState } from '~/models/comment'
import { adminQueryKeys } from '~/query/keys'
import { CompactPagination } from '~/ui/data/compact-pagination'
import { confirmDialog } from '~/ui/feedback/confirm'
import { FocusScope } from '~/ui/focus-scope'
import type { ShortcutItem } from '~/ui/keyboard-shortcut-overlay'
import { useRegisterShortcuts } from '~/ui/keyboard-shortcut-overlay'
import { MasterDetailShell } from '~/ui/layout/master-detail-shell'
import { useListKeyboard } from '~/ui/list-actions'
import { EmptyState } from '~/ui/patterns/EmptyState'
import { Button } from '~/ui/primitives/button'
import { Combobox } from '~/ui/primitives/combobox'
import { Scroll } from '~/ui/primitives/scroll'
import { cn } from '~/utils/cn'

import { commentsPageSize } from '../constants'
import { useCommentMutations } from '../hooks/use-comment-mutations'
import { useCommentRouteShortcuts } from '../hooks/use-comment-route-shortcuts'
import { useCommentTabCounts } from '../hooks/use-comment-tab-counts'
import { useCommentsList } from '../hooks/use-comments-list'
import { tabToLegacyState } from '../utils/comments'
import { buildCommentActions } from './buildCommentActions'
import { CommentDetailEmpty } from './CommentDetailEmpty'
import { CommentListItem } from './CommentListItem'
import { CommentsRouteContext } from './comments-route-context'
import type { RefTypeFilter } from './FilterStrip'
import { SelectionBar } from './SelectionBar'
import type { TopBarTab } from './TopBar'
import { TopBar } from './TopBar'

const FOCUS_SCOPE_ID = 'comments-list'
const TAB_ORDER: ReadonlyArray<CommentTab> = [
  'all',
  'unread',
  'awaiting',
  'whispers',
  'read',
  'junk',
]

export function CommentsRouteViewContent() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const params = useParams<{ id?: string }>()
  const detailId = params.id ?? null
  const [searchParams] = useSearchParams()

  const {
    comments,
    commentsQuery,
    page,
    pagination,
    refId,
    refType,
    search,
    setFilters,
    setPage,
    setTab,
    tab,
  } = useCommentsList()

  const [selectAllMode, setSelectAllMode] = useState(false)

  const selectionClearRef = useRef<(() => void) | null>(null)
  const composerFocusRef = useRef<(() => void) | null>(null)
  const searchFocusRef = useRef<(() => void) | null>(null)

  const buildListUrl = useCallback(() => {
    const qs = searchParams.toString()
    return `/comments${qs ? `?${qs}` : ''}`
  }, [searchParams])

  const closeDetail = useCallback(() => {
    navigate(buildListUrl())
  }, [buildListUrl, navigate])

  const selectedTargetsRef = useRef<CommentModel[]>([])
  const legacyState = tabToLegacyState(tab)

  const {
    batchDeleteMutation,
    batchStateMutation,
    deleteMutation,
    markReadOnOpenMutation,
    replyMutation,
    stateMutation,
  } = useCommentMutations({
    getSelectedTargets: () => selectedTargetsRef.current,
    onAfterBatchSuccess: () => selectionClearRef.current?.(),
    onAfterDeleteSuccess: () => {
      selectionClearRef.current?.()
      navigate(buildListUrl())
    },
    refId,
    refType,
    search,
    selectAllMode,
    state: legacyState,
  })

  const tabCounts = useCommentTabCounts({ refId, refType })

  const openComment = useCallback(
    (comment: CommentModel) => {
      // Mark as read when opening — only fires for genuinely unread rows so
      // we don't spam the server when navigating among already-read items.
      if (comment.state === CommentState.Unread) {
        markReadOnOpenMutation.mutate(comment.id)
      }
      const qs = searchParams.toString()
      navigate(`/comments/${comment.id}${qs ? `?${qs}` : ''}`)
    },
    [markReadOnOpenMutation, navigate, searchParams],
  )

  // The list snapshot can change between an action firing and resolving (e.g.
  // mutation invalidates the cache). Keep the freshest reference so getNextOf
  // always picks the row currently before/after the actioned id.
  const commentsRef = useRef(comments)
  commentsRef.current = comments

  const getNextOf = useCallback((id: string): CommentModel | null => {
    const snapshot = commentsRef.current
    const idx = snapshot.findIndex((entry) => entry.id === id)
    if (idx < 0) return null
    return snapshot[idx + 1] ?? snapshot[idx - 1] ?? null
  }, [])

  const confirmDeleteComments = useCallback(
    async (targets: CommentModel[]) => {
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
    },
    [batchDeleteMutation, deleteMutation, t],
  )

  const actions = useMemo(
    () =>
      buildCommentActions(
        {
          closeDetail,
          deleteMany: confirmDeleteComments,
          getNextOf,
          markState: async (id, nextState) => {
            await stateMutation.mutateAsync({ id, nextState })
          },
          open: openComment,
        },
        t,
      ),
    [
      closeDetail,
      confirmDeleteComments,
      getNextOf,
      openComment,
      stateMutation,
      t,
    ],
  )

  const { selection } = useListKeyboard<CommentModel>({
    actions,
    getId: (comment) => comment.id,
    items: comments,
    onBeforeSelectionReset: () => setSelectAllMode(false),
    onItemFocus: (id) => {
      const comment = comments.find((c) => c.id === id)
      if (comment) openComment(comment)
    },
    resetOn: [tab, page],
    scopeId: FOCUS_SCOPE_ID,
  })
  selectionClearRef.current = selection.clear
  selectedTargetsRef.current = selection.getSelectedTargets()

  const handleTabSelect = useCallback(
    (next: CommentTab) => {
      if (next === tab) return
      setSelectAllMode(false)
      setTab(next)
    },
    [setTab, tab],
  )

  const handleRefTypeChange = useCallback(
    (next: RefTypeFilter) => {
      setSelectAllMode(false)
      setFilters({
        refId: undefined,
        refType: next === 'all' ? undefined : (next as CommentRefType),
      })
    },
    [setFilters],
  )

  const applySourceFilter = useCallback(
    (comment: CommentModel) => {
      setSelectAllMode(false)
      setFilters({
        refId: comment.ref?.id ? String(comment.ref.id) : undefined,
        refType: comment.refType,
      })
    },
    [setFilters],
  )

  const handleSearch = useCallback(
    (value: string) => {
      setSelectAllMode(false)
      setFilters({ search: value || undefined })
    },
    [setFilters],
  )

  const selectedCount = selectAllMode
    ? (pagination?.total ?? 0)
    : selection.size
  const hasSelection = selectedCount > 0
  const totalAvailable = pagination?.total ?? 0

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

  const tabs = useMemo<ReadonlyArray<TopBarTab<CommentTab>>>(
    () =>
      TAB_ORDER.map((key) => ({
        count: tabCounts.counts?.[key],
        key,
        label: t(`comments.tab.${key}` as const),
      })),
    [tabCounts.counts, t],
  )

  useCommentRouteShortcuts({
    focusComposer: () => composerFocusRef.current?.(),
    focusSearch: () => searchFocusRef.current?.(),
    navigateTab: handleTabSelect,
  })

  const shortcutItems = useMemo<ReadonlyArray<ShortcutItem>>(() => {
    const groupNav = t('comments.shortcuts.group.navigation')
    const groupSel = t('comments.shortcuts.group.selection')
    const groupAction = t('comments.shortcuts.group.action')
    const groupComposer = t('comments.shortcuts.group.composer')
    const groupGlobal = t('comments.shortcuts.group.global')
    return [
      {
        group: groupNav,
        key: 'nav-j',
        label: 'j',
        hint: t('comments.shortcuts.nav.next'),
      },
      {
        group: groupNav,
        key: 'nav-k',
        label: 'k',
        hint: t('comments.shortcuts.nav.previous'),
      },
      {
        group: groupNav,
        key: 'nav-enter',
        label: '↵',
        hint: t('comments.shortcuts.nav.open'),
      },
      {
        group: groupNav,
        key: 'nav-search',
        label: '/',
        hint: t('comments.shortcuts.nav.search'),
      },
      {
        group: groupNav,
        key: 'nav-gu',
        label: 'g u',
        hint: t('comments.shortcuts.nav.unread'),
      },
      {
        group: groupNav,
        key: 'nav-gr',
        label: 'g r',
        hint: t('comments.shortcuts.nav.read'),
      },
      {
        group: groupNav,
        key: 'nav-gj',
        label: 'g j',
        hint: t('comments.shortcuts.nav.junk'),
      },
      {
        group: groupNav,
        key: 'nav-gw',
        label: 'g w',
        hint: t('comments.shortcuts.nav.whispers'),
      },
      {
        group: groupNav,
        key: 'nav-ga',
        label: 'g a',
        hint: t('comments.shortcuts.nav.awaiting'),
      },
      {
        group: groupNav,
        key: 'nav-gl',
        label: 'g l',
        hint: t('comments.shortcuts.nav.all'),
      },
      {
        group: groupSel,
        key: 'sel-space',
        label: 'Space',
        hint: t('comments.shortcuts.sel.toggle'),
      },
      {
        group: groupSel,
        key: 'sel-x',
        label: 'x',
        hint: t('comments.shortcuts.sel.check'),
      },
      {
        group: groupSel,
        key: 'sel-shift-j',
        label: '⇧j',
        hint: t('comments.shortcuts.sel.rangeDown'),
      },
      {
        group: groupSel,
        key: 'sel-shift-k',
        label: '⇧k',
        hint: t('comments.shortcuts.sel.rangeUp'),
      },
      {
        group: groupSel,
        key: 'sel-mod-a',
        label: '⌘a',
        hint: t('comments.shortcuts.sel.all'),
      },
      {
        group: groupSel,
        key: 'sel-esc',
        label: 'Esc',
        hint: t('comments.shortcuts.sel.clear'),
      },
      {
        group: groupAction,
        key: 'act-e',
        label: 'E',
        hint: t('comments.shortcuts.act.markRead'),
      },
      {
        group: groupAction,
        key: 'act-alt-e',
        label: '⌥E',
        hint: t('comments.shortcuts.act.markReadNext'),
      },
      {
        group: groupAction,
        key: 'act-s',
        label: 'S',
        hint: t('comments.shortcuts.act.markJunk'),
      },
      {
        group: groupAction,
        key: 'act-alt-s',
        label: '⌥S',
        hint: t('comments.shortcuts.act.markJunkNext'),
      },
      {
        group: groupAction,
        key: 'act-del',
        label: '⌫',
        hint: t('comments.shortcuts.act.delete'),
      },
      {
        group: groupComposer,
        key: 'comp-r',
        label: 'r',
        hint: t('comments.shortcuts.composer.reply'),
      },
      {
        group: groupComposer,
        key: 'comp-send',
        label: '⌘↵',
        hint: t('comments.shortcuts.composer.send'),
      },
      {
        group: groupComposer,
        key: 'comp-esc',
        label: 'Esc',
        hint: t('comments.shortcuts.composer.discard'),
      },
      {
        group: groupGlobal,
        key: 'global-?',
        label: '?',
        hint: t('comments.shortcuts.global.overlay'),
      },
    ]
  }, [t])
  useRegisterShortcuts(shortcutItems)

  const routeContextValue = useMemo(
    () => ({
      currentState: legacyState,
      onBack: closeDetail,
      onDelete: (comment: CommentModel) => {
        void confirmDeleteComments([comment])
      },
      onReply: (id: string, text: string) =>
        replyMutation.mutateAsync({ id, text }),
      onStateChange: (id: string, nextState: CommentState) =>
        stateMutation.mutate({ id, nextState }),
      registerComposerFocus: (handler: (() => void) | null) => {
        composerFocusRef.current = handler
      },
      replyPending: replyMutation.isPending,
    }),
    [
      closeDetail,
      confirmDeleteComments,
      legacyState,
      replyMutation,
      stateMutation,
    ],
  )

  const sourceLabelFromComments = useMemo(() => {
    if (!refId) return undefined
    const match = comments.find(
      (entry) => entry.ref?.id != null && String(entry.ref.id) === refId,
    )
    const title = match?.ref?.title
    return typeof title === 'string' && title.length > 0 ? title : undefined
  }, [comments, refId])

  return (
    <CommentsRouteContext.Provider value={routeContextValue}>
      <MasterDetailShell
        defaultSize={480}
        detailScopeId={`${FOCUS_SCOPE_ID}-detail`}
        emptyDetail={<CommentDetailEmpty />}
        list={
          <FocusScope
            className="outline-hidden flex h-full min-h-0 flex-col"
            id={FOCUS_SCOPE_ID}
          >
            <div className="shrink-0 border-b border-border bg-surface-card">
              <TopBar<CommentTab>
                activeKey={tab}
                filterActive={Boolean(refType || refId)}
                filterContent={
                  <CommentFilterPanel
                    onClearSource={
                      refId ? () => setFilters({ refId: undefined }) : undefined
                    }
                    onRefTypeChange={handleRefTypeChange}
                    onSourceClear={() => setFilters({ refId: undefined })}
                    onSourceSelect={(source) => {
                      setSelectAllMode(false)
                      setFilters({ refId: source.id, refType: source.type })
                    }}
                    refId={refId}
                    refType={(refType ?? 'all') as RefTypeFilter}
                    sourceLabel={sourceLabelFromComments}
                    sourceRefType={refType}
                    total={pagination?.total}
                  />
                }
                initialSearch={search}
                isRefreshing={commentsQuery.isFetching}
                onRefresh={() => void commentsQuery.refetch()}
                onSearch={handleSearch}
                onSelect={handleTabSelect}
                searchPlaceholder={t('comments.search.placeholder')}
                tabs={tabs}
              />

              {hasSelection ? (
                <SelectionBar
                  canMarkJunk={tab !== 'junk'}
                  canMarkRead={tab !== 'read'}
                  isAllPageMode={selectAllMode}
                  onClear={() => selection.clear()}
                  onDelete={confirmBatchDelete}
                  onMarkJunk={() =>
                    batchStateMutation.mutate(CommentState.Junk)
                  }
                  onMarkRead={() =>
                    batchStateMutation.mutate(CommentState.Read)
                  }
                  onSelectAllAcrossPages={
                    pagination && pagination.totalPages > 1
                      ? () => setSelectAllMode(true)
                      : undefined
                  }
                  selectedCount={selectedCount}
                  totalAvailable={totalAvailable}
                />
              ) : null}
            </div>

            {comments.length === 0 && !commentsQuery.isLoading ? (
              <div className="flex flex-1 items-center justify-center p-6">
                <CommentRouteEmptyState
                  hasFilters={Boolean(refId || refType || search)}
                  onClearFilters={() =>
                    setFilters({
                      refId: undefined,
                      refType: undefined,
                      search: undefined,
                    })
                  }
                  searchTerm={search}
                  sourceLabel={sourceLabelFromComments}
                  tab={tab}
                />
              </div>
            ) : (
              <Scroll className="flex-1">
                {commentsQuery.isLoading && comments.length === 0 ? (
                  <CommentListSkeleton />
                ) : (
                  comments.map((comment) => (
                    <CommentListItem
                      actions={actions}
                      checked={selection.isSelected(comment.id)}
                      comment={comment}
                      currentFilter={legacyState}
                      cursor={selection.isCursor(comment.id)}
                      isDetailTarget={detailId === comment.id}
                      key={comment.id}
                      onCheck={() => selection.toggleWithAnchor(comment.id)}
                      onMarkJunk={(id) =>
                        stateMutation.mutate({
                          id,
                          nextState: CommentState.Junk,
                        })
                      }
                      onMarkRead={(id) =>
                        stateMutation.mutate({
                          id,
                          nextState: CommentState.Read,
                        })
                      }
                      onSelect={(mode) => {
                        if (mode === 'range') selection.selectRange(comment.id)
                        else if (mode === 'toggle')
                          selection.toggleWithAnchor(comment.id)
                        else {
                          selection.setCursor(comment.id)
                          openComment(comment)
                        }
                      }}
                      onSourceFilter={applySourceFilter}
                      selected={selection.isSelected(comment.id)}
                    />
                  ))
                )}
              </Scroll>
            )}

            {pagination && pagination.totalPages > 1 ? (
              <div className="flex shrink-0 items-center justify-end border-t border-border px-4 py-2">
                <CompactPagination
                  onPageChange={(next) => setPage(next)}
                  onPageSizeChange={() => {
                    /* page size is fixed for comments; selector is hidden by
                     * passing a single-entry pageSizes list */
                  }}
                  page={pagination.page}
                  pageCount={pagination.totalPages}
                  pageSize={commentsPageSize}
                  pageSizes={[commentsPageSize]}
                />
              </div>
            ) : null}
          </FocusScope>
        }
      />
    </CommentsRouteContext.Provider>
  )
}

function CommentListSkeleton() {
  return (
    <div className="space-y-2 p-4" data-testid="comments-list-skeleton">
      {[0, 1, 2].map((idx) => (
        <div
          className="flex animate-pulse gap-3 rounded-md bg-surface-inset p-3"
          key={idx}
        >
          <div className="size-8 shrink-0 rounded-full bg-surface-card" />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <div className="h-3 w-2/5 rounded bg-surface-card" />
            <div className="h-3 w-4/5 rounded bg-surface-card" />
            <div className="h-3 w-3/5 rounded bg-surface-card" />
          </div>
        </div>
      ))}
    </div>
  )
}

interface TabEmptyMeta {
  icon: LucideIcon
  titleKey: TranslationKey
  descriptionKey: TranslationKey
  actionKey?: TranslationKey
}

const TAB_EMPTY_META: Record<CommentTab, TabEmptyMeta> = {
  unread: {
    actionKey: 'comments.empty.unread.action',
    descriptionKey: 'comments.empty.unread.description',
    icon: Inbox,
    titleKey: 'comments.empty.unread.title',
  },
  awaiting: {
    descriptionKey: 'comments.empty.awaiting.description',
    icon: MessageCircleReply,
    titleKey: 'comments.empty.awaiting.title',
  },
  whispers: {
    descriptionKey: 'comments.empty.whispers.description',
    icon: Lock,
    titleKey: 'comments.empty.whispers.title',
  },
  read: {
    descriptionKey: 'comments.empty.read.description',
    icon: CheckCheck,
    titleKey: 'comments.empty.read.title',
  },
  junk: {
    descriptionKey: 'comments.empty.junk.description',
    icon: ShieldAlert,
    titleKey: 'comments.empty.junk.title',
  },
  all: {
    actionKey: 'comments.empty.all.action',
    descriptionKey: 'comments.empty.all.description',
    icon: MessageSquare,
    titleKey: 'comments.empty.all.title',
  },
}

function CommentRouteEmptyState(props: {
  hasFilters: boolean
  onClearFilters: () => void
  searchTerm?: string
  sourceLabel?: string
  tab: CommentTab
}) {
  const { t } = useI18n()
  if (props.hasFilters) {
    const queryEcho = props.searchTerm
      ? t('comments.empty.filtered.searchEcho', { query: props.searchTerm })
      : props.sourceLabel
        ? t('comments.empty.filtered.sourceEcho', { source: props.sourceLabel })
        : t('comments.empty.filtered.description')
    return (
      <EmptyState
        action={
          <Button onClick={props.onClearFilters} type="button" variant="subtle">
            {t('comments.empty.filtered.action')}
          </Button>
        }
        className="max-w-sm"
        description={queryEcho}
        icon={MessageSquare}
        title={t('comments.empty.filtered.title')}
      />
    )
  }
  const meta = TAB_EMPTY_META[props.tab]
  return (
    <div data-testid={`comments-empty-${props.tab}`}>
      <EmptyState
        action={
          meta.actionKey ? (
            <Button type="button" variant="subtle">
              {t(meta.actionKey)}
            </Button>
          ) : undefined
        }
        className="max-w-sm"
        description={t(meta.descriptionKey)}
        icon={meta.icon}
        title={t(meta.titleKey)}
      />
    </div>
  )
}

function CommentFilterPanel(props: {
  refType: RefTypeFilter
  onRefTypeChange: (next: RefTypeFilter) => void
  sourceLabel?: string
  onClearSource?: () => void
  sourceRefType?: CommentRefType
  refId?: string
  onSourceSelect: (source: {
    id: string
    title: string
    type: CommentRefType
  }) => void
  onSourceClear: () => void
  total?: number
}) {
  const { format, t } = useI18n()
  const REF_TYPES: ReadonlyArray<RefTypeFilter> = [
    'all',
    'post',
    'note',
    'page',
  ]

  return (
    <div className="w-72 space-y-3 text-sm" data-testid="comments-filter-panel">
      <div className="space-y-1.5">
        <p className="text-xs font-semibold uppercase tracking-wide text-fg-subtle">
          {t('comments.filter.refTypeLabel')}
        </p>
        <div className="flex flex-wrap items-center gap-1">
          {REF_TYPES.map((value) => {
            const isActive = props.refType === value
            const label =
              value === 'all'
                ? t('comments.filter.allSources')
                : t(`comments.refType.${value}` as const)
            return (
              <button
                aria-pressed={isActive}
                className={cn(
                  'inline-flex h-7 items-center rounded-full px-3 text-xs font-medium transition-colors',
                  'focus-visible:outline-hidden focus-visible:ring-[3px] focus-visible:ring-accent/15',
                  isActive
                    ? 'bg-accent-soft text-accent'
                    : 'text-fg-muted hover:bg-surface-inset hover:text-fg',
                )}
                data-testid={`comments-reftype-${value}`}
                key={value}
                onClick={() => props.onRefTypeChange(value)}
                type="button"
              >
                {label}
              </button>
            )
          })}
        </div>
      </div>

      <div className="space-y-1.5">
        <p className="text-xs font-semibold uppercase tracking-wide text-fg-subtle">
          {t('comments.filter.sourceLabel')}
        </p>
        <CommentSourceCombobox
          fluid
          onClear={props.onSourceClear}
          onSelect={props.onSourceSelect}
          refId={props.refId}
          refType={props.sourceRefType}
        />
        {props.sourceLabel ? (
          <div
            className="flex items-center gap-1"
            data-testid="comments-source-chip"
          >
            <span className="inline-flex h-7 min-w-0 items-center gap-1 rounded-full bg-accent-soft px-3 text-xs font-medium text-accent">
              <span className="max-w-[14rem] truncate">
                {props.sourceLabel}
              </span>
              {props.onClearSource ? (
                <button
                  aria-label={t('comments.filter.clearSource')}
                  className="inline-flex size-4 items-center justify-center rounded-full text-accent hover:bg-accent/15 focus-visible:outline-hidden focus-visible:ring-[3px] focus-visible:ring-accent/15"
                  data-testid="comments-source-chip-clear"
                  onClick={props.onClearSource}
                  type="button"
                >
                  <X aria-hidden="true" className="size-3" />
                </button>
              ) : null}
            </span>
          </div>
        ) : null}
      </div>

      {props.total != null ? (
        <div className="border-t border-border pt-2 text-xs tabular-nums text-fg-subtle">
          {t('comments.list.totalCount', {
            count: format.number(props.total),
          })}
        </div>
      ) : null}
    </div>
  )
}

function CommentSourceCombobox(props: {
  onClear: () => void
  onSelect: (source: {
    id: string
    title: string
    type: CommentRefType
  }) => void
  refId?: string
  refType?: CommentRefType
  /** Stretch the combobox control to fill its parent (popover layout). */
  fluid?: boolean
}) {
  const { t } = useI18n()
  const [input, setInput] = useState('')
  const sourceQuery = useQuery({
    queryFn: () =>
      getCommentSourceCandidates({
        refType: props.refType,
        search: input.trim() || undefined,
        size: 20,
      }),
    queryKey: adminQueryKeys.comments.sourceCandidates({
      refType: props.refType,
      search: input.trim(),
    }),
  })
  const items = useMemo(
    () =>
      (sourceQuery.data?.data ?? []).map((item) => ({
        id: item.id,
        label: item.title || item.id,
        type: item.type,
      })),
    [sourceQuery.data],
  )

  return (
    <div className="flex min-w-0 items-center gap-1">
      <Combobox
        autoComplete="none"
        inputValue={input}
        items={items}
        onInputValueChange={setInput}
        onValueChange={(next) => {
          if (!next || typeof next !== 'object') return
          const source = next as {
            id: string
            label: string
            type: CommentRefType
          }
          props.onSelect({
            id: source.id,
            title: source.label,
            type: source.type,
          })
          setInput(source.label)
        }}
        value={null}
      >
        <Combobox.Control className={props.fluid ? 'w-full' : 'w-40'}>
          <Combobox.Input
            aria-label={t('comments.filter.sourceLabel')}
            className="h-8 text-xs"
            placeholder={
              props.refId
                ? t('comments.filter.sourceSelected')
                : t('comments.filter.sourcePlaceholder')
            }
          />
          <Combobox.Trigger aria-label={t('comments.filter.sourceLabel')}>
            {sourceQuery.isFetching ? (
              <Loader2 aria-hidden="true" className="size-4 animate-spin" />
            ) : (
              <ChevronDown aria-hidden="true" className="size-4" />
            )}
          </Combobox.Trigger>
        </Combobox.Control>
        <Combobox.Content>
          <Combobox.Empty>{t('comments.filter.noSources')}</Combobox.Empty>
          <Scroll
            className="max-h-72"
            innerClassName="p-1"
            viewportClassName="max-h-72"
          >
            <Combobox.List>
              {(item: { id: string; label: string; type: CommentRefType }) => (
                <Combobox.Item key={`${item.type}:${item.id}`} value={item}>
                  <span className="truncate">{item.label}</span>
                  <span className="ml-2 text-xs uppercase text-fg-subtle">
                    {item.type}
                  </span>
                </Combobox.Item>
              )}
            </Combobox.List>
          </Scroll>
        </Combobox.Content>
      </Combobox>
      {props.refId ? (
        <Button
          aria-label={t('comments.filter.clearSource')}
          className="h-8 px-2"
          onClick={() => {
            props.onClear()
            setInput('')
          }}
          type="button"
          variant="subtle"
        >
          <X aria-hidden="true" className="size-3.5" />
        </Button>
      ) : null}
    </div>
  )
}
