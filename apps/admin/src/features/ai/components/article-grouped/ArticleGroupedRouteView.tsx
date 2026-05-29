import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { RefreshCw } from 'lucide-react'
import { useEffect, useLayoutEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import { toast } from 'sonner'
import type { ArticleInfo } from '~/api/ai'
import type { HeaderAction } from '~/ui/layout/page-layout'
import type { ArticleGroupedConfig } from './types'

import { useI18n } from '~/i18n'
import { confirmDialog } from '~/ui/feedback/confirm'
import { ContentLayout, ContentLayoutSlot } from '~/ui/layout/content-layout'
import {
  AppPage,
  MasterDetailLayout,
  PageHeader,
} from '~/ui/layout/page-layout'

import { groupedPageSize } from '../../constants'
import { getErrorMessage } from '../../utils/ai'
import { ArticleDetailEmptyState } from './ArticleDetailEmptyState'
import { ArticleDetailPane } from './ArticleDetailPane'
import { ArticleEditPanel } from './ArticleEditPanel'
import { ArticleListPane } from './ArticleListPane'
import { useItemActions } from './useItemActions'

const SEARCH_DEBOUNCE_MS = 300

interface ArticleGroupedRouteViewProps<TItem> {
  config: ArticleGroupedConfig<TItem>
}

export function ArticleGroupedRouteView<TItem>(
  props: ArticleGroupedRouteViewProps<TItem>,
) {
  const { config } = props
  const { t } = useI18n()
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const searchParamsKey = searchParams.toString()
  const idParam = searchParams.get('id')

  const [inputSearch, setInputSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(
    () => idParam,
  )
  const [showDetailOnMobile, setShowDetailOnMobile] = useState(() =>
    Boolean(idParam),
  )
  const [editingItemId, setEditingItemId] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(inputSearch.trim())
    }, SEARCH_DEBOUNCE_MS)
    return () => window.clearTimeout(timer)
  }, [inputSearch])

  useLayoutEffect(() => {
    setSelectedArticleId((value) => (value === idParam ? value : idParam))
    setShowDetailOnMobile(Boolean(idParam))
  }, [searchParamsKey, idParam])

  useEffect(() => {
    const next = new URLSearchParams(searchParams)
    if (selectedArticleId) {
      next.set('id', selectedArticleId)
    } else {
      next.delete('id')
    }
    if (next.toString() !== searchParamsKey) {
      setSearchParams(next, { replace: true })
    }
  }, [searchParams, searchParamsKey, selectedArticleId, setSearchParams])

  const listQuery = useInfiniteQuery({
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      config.getGroupedPage({
        page: pageParam,
        search: debouncedSearch || undefined,
        size: groupedPageSize,
      }),
    getNextPageParam: (lastPage) => {
      const pagination = lastPage.pagination
      if (!pagination?.hasNextPage) return undefined
      const current = pagination.currentPage ?? pagination.page ?? 1
      return current + 1
    },
    queryKey: ['ai', config.groupedQueryKey, 'grouped', debouncedSearch],
  })

  const groups = useMemo(
    () => listQuery.data?.pages.flatMap((page) => page.data) ?? [],
    [listQuery.data],
  )
  const total = listQuery.data?.pages[0]?.pagination.total ?? 0

  const detailQuery = useQuery({
    enabled: Boolean(selectedArticleId),
    queryFn: () => config.getItemsByRef(selectedArticleId!),
    queryKey: ['ai', config.groupedQueryKey, 'by-ref', selectedArticleId],
  })

  const detailArticle: ArticleInfo | null = useMemo(() => {
    if (!selectedArticleId) return null
    const fromList = groups.find((g) => g.article.id === selectedArticleId)
    if (fromList) return fromList.article
    const detail = detailQuery.data?.article
    if (detail) {
      return {
        id: selectedArticleId,
        title: detail.document.title,
        type: detail.type,
      }
    }
    return null
  }, [groups, detailQuery.data, selectedArticleId])

  const detailItems: TItem[] = detailQuery.data?.items ?? []

  const invalidate = async () => {
    await queryClient.invalidateQueries({
      queryKey: ['ai', config.groupedQueryKey],
    })
    await queryClient.invalidateQueries({ queryKey: ['ai', 'tasks'] })
  }

  const deleteMutation = useMutation({
    mutationFn: config.deleteItem,
    onError: (error: unknown) =>
      toast.error(getErrorMessage(error, t('ai.toast.deleteFailed'))),
    onSuccess: async () => {
      toast.success(t('ai.toast.deleted'))
      await invalidate()
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, next }: { id: string; next: TItem }) =>
      config.updateItem(id, next),
    onError: (error: unknown) =>
      toast.error(getErrorMessage(error, t('ai.toast.deleteFailed'))),
    onSuccess: async () => {
      toast.success(t('ai.toast.saved'))
      setEditingItemId(null)
      await invalidate()
    },
  })

  const generateMutation = useMutation({
    mutationFn: (input: { refId: string; lang?: string }) =>
      config.generate.runTask(input),
    onError: (error: unknown) =>
      toast.error(getErrorMessage(error, t('ai.toast.taskCreateFailed'))),
    onSuccess: async (result) => {
      toast.success(
        result.created ? t('ai.toast.taskCreated') : t('ai.toast.taskExists'),
      )
      setGenerating(false)
      await invalidate()
    },
  })

  const extraActionMutation = useMutation({
    mutationFn: async (input: {
      item: TItem
      run: (item: TItem) => Promise<unknown>
    }) => input.run(input.item),
    onError: (error: unknown) =>
      toast.error(getErrorMessage(error, t('ai.toast.taskCreateFailed'))),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['ai'] })
    },
  })

  const confirmAndDelete = async (item: TItem) => {
    const ok = await confirmDialog({
      destructive: true,
      title: t(config.itemDeleteConfirmKey, { kind: t(config.kindKey) }),
    })
    if (!ok) return
    deleteMutation.mutate(config.getId(item))
  }

  const { keyboardActions, buildMenu } = useItemActions<TItem>({
    config,
    onEdit: (item) => setEditingItemId(config.getId(item)),
    onDelete: (item) => void confirmAndDelete(item),
    onExtraAction: (item, run) => extraActionMutation.mutate({ item, run }),
  })

  const editingItem: TItem | null = useMemo(() => {
    if (!editingItemId) return null
    return (
      detailItems.find((item) => config.getId(item) === editingItemId) ?? null
    )
  }, [detailItems, editingItemId, config])

  const handleSelectArticle = (article: ArticleInfo) => {
    setSelectedArticleId(article.id)
    setShowDetailOnMobile(true)
  }

  const closeEditPanel = () => {
    setEditingItemId(null)
    setGenerating(false)
  }

  const headerActions: HeaderAction[] = [
    ...(config.pageActions?.({ invalidate }) ?? []),
    {
      kind: 'button',
      iconOnly: true,
      icon: RefreshCw,
      label: t('common.refresh'),
      onClick: () => {
        void listQuery.refetch()
        if (selectedArticleId) void detailQuery.refetch()
      },
      disabled: listQuery.isFetching || detailQuery.isFetching,
    },
  ]

  return (
    <AppPage>
      <PageHeader
        actions={headerActions}
        description={
          total > 0 ? t(config.totalCountKey, { count: total }) : undefined
        }
        title={t(config.pageTitleKey)}
      />

      <MasterDetailLayout
        detail={
          detailArticle ? (
            <ContentLayout
              asideDefaultSize="70%"
              asideMaxSize="85%"
              asideMinSize="480px"
              asideMobileTitle={
                editingItem
                  ? t(config.editTitleKey)
                  : t(config.generate.labelKey)
              }
              className="h-full"
              mainMinSize="280px"
              onCloseAside={closeEditPanel}
              open={Boolean(editingItem) || generating}
            >
              <ArticleDetailPane<TItem>
                article={detailArticle}
                buildMenu={buildMenu}
                config={config}
                isLoading={detailQuery.isLoading}
                items={detailItems}
                keyboardActions={keyboardActions}
                onBack={() => setShowDetailOnMobile(false)}
                onDelete={(item) => void confirmAndDelete(item)}
                onEdit={(item) => setEditingItemId(config.getId(item))}
                onGenerate={() => setGenerating(true)}
                onItemFocus={(item) => {
                  if (editingItemId !== null) {
                    setEditingItemId(config.getId(item))
                  }
                }}
              />
              <ContentLayoutSlot
                active={Boolean(editingItem) || generating}
                id="ai-article-edit"
              >
                <ArticleEditPanel<TItem>
                  config={config}
                  editingItem={editingItem}
                  generateSubmitting={generateMutation.isPending}
                  mode={editingItem ? 'edit' : 'generate'}
                  onClose={closeEditPanel}
                  onGenerate={async (lang) => {
                    if (!selectedArticleId) return
                    await generateMutation.mutateAsync({
                      refId: selectedArticleId,
                      lang,
                    })
                  }}
                  onUpdate={async (next) => {
                    await updateMutation.mutateAsync({
                      id: config.getId(next),
                      next,
                    })
                  }}
                  selectedArticleId={selectedArticleId}
                  updateSubmitting={updateMutation.isPending}
                />
              </ContentLayoutSlot>
            </ContentLayout>
          ) : (
            <ArticleDetailEmptyState
              description={t(config.detailEmptyDescriptionKey)}
              title={t(config.detailEmptyTitleKey)}
            />
          )
        }
        list={
          <ArticleListPane<TItem>
            config={config}
            groups={groups}
            hasNextPage={Boolean(listQuery.hasNextPage)}
            isFetchingNextPage={listQuery.isFetchingNextPage}
            isLoading={listQuery.isLoading}
            onLoadMore={() => void listQuery.fetchNextPage()}
            onSearchChange={setInputSearch}
            onSelectArticle={handleSelectArticle}
            search={inputSearch}
            selectedArticleId={selectedArticleId}
          />
        }
        showDetailOnMobile={showDetailOnMobile}
      />
    </AppPage>
  )
}
