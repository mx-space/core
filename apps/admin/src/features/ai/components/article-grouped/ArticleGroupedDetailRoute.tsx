import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { useParams } from 'react-router'
import { toast } from 'sonner'

import type { ArticleInfo } from '~/api/ai'
import { useI18n } from '~/i18n'
import { adminQueryKeys } from '~/query/keys'
import { confirmDialog } from '~/ui/feedback/confirm'
import { ContentLayout, ContentLayoutSlot } from '~/ui/layout/content-layout'

import { getErrorMessage } from '../../utils/ai'
import { useArticleGroupedRouteContext } from './article-grouped-route-context'
import { ArticleDetailEmptyState } from './ArticleDetailEmptyState'
import { ArticleDetailPane } from './ArticleDetailPane'
import { ArticleEditPanel } from './ArticleEditPanel'
import { useItemActions } from './useItemActions'

export function ArticleGroupedDetailRoute<TItem>() {
  const { id } = useParams<{ id: string }>()
  const { t } = useI18n()
  const queryClient = useQueryClient()
  const ctx = useArticleGroupedRouteContext<TItem>()
  const { config } = ctx

  const [editingItemId, setEditingItemId] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)

  const detailQuery = useQuery({
    enabled: Boolean(id),
    queryFn: () => config.getItemsByRef(id!),
    queryKey: adminQueryKeys.ai.groupedByRef({
      group: config.groupedQueryKey,
      id: id ?? '',
    }),
  })

  const detailArticle: ArticleInfo | null = useMemo(() => {
    if (!id) return null
    // Try list cache first to avoid loading flash.
    const listEntries = queryClient.getQueriesData<{
      pages?: Array<{
        data: Array<{ article: ArticleInfo }>
      }>
    }>({
      queryKey: adminQueryKeys.ai.groupedListRoot(config.groupedQueryKey),
    })
    for (const [, data] of listEntries) {
      const pages = data?.pages
      if (!pages) continue
      for (const page of pages) {
        const hit = page.data.find((g) => g.article.id === id)
        if (hit) return hit.article
      }
    }
    const detail = detailQuery.data?.article
    if (detail) {
      return {
        id,
        title: detail.document.title,
        type: detail.type,
      }
    }
    return null
  }, [config.groupedQueryKey, detailQuery.data, id, queryClient])

  const detailItems: TItem[] = detailQuery.data?.items ?? []

  const deleteMutation = useMutation({
    mutationFn: config.deleteItem,
    onError: (error: unknown) =>
      toast.error(getErrorMessage(error, t('ai.toast.deleteFailed'))),
    onSuccess: async () => {
      toast.success(t('ai.toast.deleted'))
      await ctx.invalidate()
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id: itemId, next }: { id: string; next: TItem }) =>
      config.updateItem(itemId, next),
    onError: (error: unknown) =>
      toast.error(getErrorMessage(error, t('ai.toast.deleteFailed'))),
    onSuccess: async () => {
      toast.success(t('ai.toast.saved'))
      setEditingItemId(null)
      await ctx.invalidate()
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
      await ctx.invalidate()
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
      await queryClient.invalidateQueries({ queryKey: adminQueryKeys.ai.root })
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

  const closeEditPanel = () => {
    setEditingItemId(null)
    setGenerating(false)
  }

  if (!id || !detailArticle) {
    return (
      <ArticleDetailEmptyState
        description={t(config.detailEmptyDescriptionKey)}
        title={t(config.detailEmptyTitleKey)}
      />
    )
  }

  return (
    <ContentLayout
      asideDefaultSize="70%"
      asideMaxSize="85%"
      asideMinSize="480px"
      asideMobileTitle={
        editingItem ? t(config.editTitleKey) : t(config.generate.labelKey)
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
        onBack={ctx.onBack}
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
            if (!id) return
            await generateMutation.mutateAsync({ refId: id, lang })
          }}
          onUpdate={async (next) => {
            await updateMutation.mutateAsync({
              id: config.getId(next),
              next,
            })
          }}
          selectedArticleId={id}
          updateSubmitting={updateMutation.isPending}
        />
      </ContentLayoutSlot>
    </ContentLayout>
  )
}

export default ArticleGroupedDetailRoute
