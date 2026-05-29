import { Languages, Plus, Sparkles } from 'lucide-react'
import { useMemo } from 'react'
import type { AIInsights } from '~/api/ai'
import type { ArticleGroupedConfig } from '../components/article-grouped/types'

import {
  createInsightsTask,
  createInsightsTranslationTask,
  deleteInsights,
  getInsightsByRef,
  getInsightsGrouped,
  updateInsights,
} from '~/api/ai'

import { ArticleGroupedRouteView } from '../components/article-grouped/ArticleGroupedRouteView'
import { InsightsEditBody } from '../components/article-grouped/InsightsEditBody'

export function AiInsightsRouteView() {
  const config = useMemo<ArticleGroupedConfig<AIInsights>>(
    () => ({
      scopeIdPrefix: 'ai-insights',
      pageTitleKey: 'routes.aiInsights.title',
      totalCountKey: 'ai.articleGrouped.totalCount',
      itemCountKey: 'ai.articleGrouped.itemCount',
      searchPlaceholderKey: 'ai.insights.searchPlaceholder',
      emptyTitleKey: 'ai.articleGrouped.emptyTitle',
      emptyDescriptionKey: 'ai.articleGrouped.emptyDescription',
      detailEmptyTitleKey: 'ai.insights.emptyTitle',
      detailEmptyDescriptionKey: 'ai.insights.emptyDescription',
      detailSectionTitleKey: 'ai.insights.detailSectionTitle',
      inlineEmptyKey: 'ai.articleGrouped.inlineEmpty',
      itemDeleteConfirmKey: 'ai.articleGrouped.confirmDelete',
      editTitleKey: 'ai.insights.editTitle',
      kindKey: 'ai.insights.kind',

      groupedQueryKey: 'insights',
      getGroupedPage: async (params) => {
        const response = await getInsightsGrouped(params)
        return {
          data: response.data.map((group) => ({
            article: group.article,
            items: group.insights,
          })),
          pagination: response.pagination,
        }
      },
      getItemsByRef: async (refId) => {
        const response = await getInsightsByRef(refId)
        return { article: response.article, items: response.insights }
      },
      deleteItem: deleteInsights,
      updateItem: (id, next) => updateInsights(id, { content: next.content }),

      generate: {
        labelKey: 'ai.insights.generateLabel',
        icon: Sparkles,
        promptForLang: false,
        runTask: ({ refId }) => createInsightsTask({ refId }),
        taskTypeForQueue: 'Insights',
      },

      extraItemActions: (item) => {
        const list: Array<{
          id: string
          labelKey:
            | 'ai.insights.translateLabel'
            | 'ai.action.retranslate'
            | 'ai.action.regenerate'
          icon: typeof Languages
          run: (target: AIInsights) => Promise<unknown>
        }> = [
          {
            id: 'translate',
            labelKey: 'ai.insights.translateLabel',
            icon: Languages,
            run: (target) =>
              createInsightsTranslationTask({
                refId: target.refId,
                targetLang: target.lang === 'en' ? 'zh' : 'en',
              }),
          },
        ]
        if (item.isTranslation) {
          list.push({
            id: 'retranslate',
            labelKey: 'ai.action.retranslate',
            icon: Languages,
            run: (target) =>
              createInsightsTranslationTask({
                refId: target.refId,
                targetLang: target.lang,
              }),
          })
        } else {
          list.push({
            id: 'regenerate',
            labelKey: 'ai.action.regenerate',
            icon: Plus,
            run: (target) => createInsightsTask({ refId: target.refId }),
          })
        }
        return list
      },

      getPreview: (item) => item.content,
      getLang: (item) => item.lang,
      getCreatedAt: (item) => item.createdAt,
      getId: (item) => item.id,

      EditDrawerBody: InsightsEditBody,
    }),
    [],
  )

  return <ArticleGroupedRouteView<AIInsights> config={config} />
}
