import { Plus } from 'lucide-react'
import { useMemo } from 'react'
import type { AISummary } from '~/api/ai'
import type { ArticleGroupedConfig } from '../components/article-grouped/types'

import {
  createSummaryTask,
  deleteSummary,
  getSummariesGrouped,
  getSummaryByRef,
  updateSummary,
} from '~/api/ai'

import { ArticleGroupedRouteView } from '../components/article-grouped/ArticleGroupedRouteView'
import { SummaryEditBody } from '../components/article-grouped/SummaryEditBody'

export function AiSummaryRouteView() {
  const config = useMemo<ArticleGroupedConfig<AISummary>>(
    () => ({
      scopeIdPrefix: 'ai-summary',
      pageTitleKey: 'routes.aiSummary.title',
      totalCountKey: 'ai.articleGrouped.totalCount',
      itemCountKey: 'ai.articleGrouped.itemCount',
      searchPlaceholderKey: 'ai.summary.searchPlaceholder',
      emptyTitleKey: 'ai.articleGrouped.emptyTitle',
      emptyDescriptionKey: 'ai.articleGrouped.emptyDescription',
      detailEmptyTitleKey: 'ai.summary.emptyTitle',
      detailEmptyDescriptionKey: 'ai.summary.emptyDescription',
      detailSectionTitleKey: 'ai.summary.detailSectionTitle',
      inlineEmptyKey: 'ai.articleGrouped.inlineEmpty',
      itemDeleteConfirmKey: 'ai.articleGrouped.confirmDelete',
      editTitleKey: 'ai.summary.editTitle',
      kindKey: 'ai.summary.kind',

      groupedQueryKey: 'summaries',
      getGroupedPage: async (params) => {
        const response = await getSummariesGrouped(params)
        return {
          data: response.data.map((group) => ({
            article: group.article,
            items: group.summaries,
          })),
          pagination: response.pagination,
        }
      },
      getItemsByRef: async (refId) => {
        const response = await getSummaryByRef(refId)
        return { article: response.article, items: response.summaries }
      },
      deleteItem: deleteSummary,
      updateItem: (id, next) => updateSummary(id, { summary: next.summary }),

      generate: {
        labelKey: 'ai.summary.generateLabel',
        icon: Plus,
        promptForLang: true,
        runTask: ({ refId, lang }) => createSummaryTask({ refId, lang }),
        taskTypeForQueue: 'Summary',
      },

      getPreview: (item) => item.summary,
      getLang: (item) => item.lang,
      getCreatedAt: (item) => item.createdAt,
      getId: (item) => item.id,

      EditDrawerBody: SummaryEditBody,
    }),
    [],
  )

  return <ArticleGroupedRouteView<AISummary> config={config} />
}
