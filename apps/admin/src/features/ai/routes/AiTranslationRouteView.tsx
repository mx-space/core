import { Languages, Plus } from 'lucide-react'
import { useMemo } from 'react'
import { toast } from 'sonner'
import type { AITranslation } from '~/api/ai'
import type { HeaderAction } from '~/ui/layout/page-layout'
import type { ArticleGroupedConfig } from '../components/article-grouped/types'

import {
  createTranslationAllTask,
  createTranslationTask,
  deleteTranslation,
  getTranslationsByRef,
  getTranslationsGrouped,
  updateTranslation,
} from '~/api/ai'
import { useI18n } from '~/i18n'

import { ArticleGroupedRouteView } from '../components/article-grouped/ArticleGroupedRouteView'
import { TranslationEditBody } from '../components/article-grouped/TranslationEditBody'
import { getErrorMessage } from '../utils/ai'

export function AiTranslationRouteView() {
  const { t } = useI18n()

  const config = useMemo<ArticleGroupedConfig<AITranslation>>(
    () => ({
      scopeIdPrefix: 'ai-translation',
      pageTitleKey: 'routes.aiTranslation.title',
      totalCountKey: 'ai.articleGrouped.totalCount',
      itemCountKey: 'ai.articleGrouped.itemCount',
      searchPlaceholderKey: 'ai.translation.searchPlaceholder',
      emptyTitleKey: 'ai.articleGrouped.emptyTitle',
      emptyDescriptionKey: 'ai.articleGrouped.emptyDescription',
      detailEmptyTitleKey: 'ai.translation.emptyTitle',
      detailEmptyDescriptionKey: 'ai.translation.emptyDescription',
      detailSectionTitleKey: 'ai.translation.detailSectionTitle',
      inlineEmptyKey: 'ai.articleGrouped.inlineEmpty',
      itemDeleteConfirmKey: 'ai.articleGrouped.confirmDelete',
      editTitleKey: 'ai.translation.editTitle',
      kindKey: 'ai.translation.kind',

      groupedQueryKey: 'translations',
      getGroupedPage: async (params) => {
        const response = await getTranslationsGrouped(params)
        return {
          data: response.data.map((group) => ({
            article: group.article,
            items: group.translations,
          })),
          pagination: response.pagination,
        }
      },
      getItemsByRef: async (refId) => {
        const response = await getTranslationsByRef(refId)
        return { article: response.article, items: response.translations }
      },
      deleteItem: deleteTranslation,
      updateItem: (id, next) =>
        updateTranslation(id, {
          title: next.title,
          subtitle: next.subtitle,
          summary: next.summary,
          text: next.text,
          content: next.content,
        }),

      generate: {
        labelKey: 'ai.translation.generateLabel',
        icon: Plus,
        promptForLang: true,
        runTask: ({ refId, lang }) =>
          createTranslationTask({
            refId,
            targetLanguages: lang ? [lang] : undefined,
          }),
        taskTypeForQueue: 'Translation',
      },

      pageActions: ({ invalidate }): HeaderAction[] => [
        {
          kind: 'button',
          icon: Languages,
          label: t('ai.action.translateAll'),
          onClick: async () => {
            try {
              const result = await createTranslationAllTask({})
              toast.success(
                result.created
                  ? t('ai.toast.translationAllCreated')
                  : t('ai.toast.translationAllExists'),
              )
              await invalidate()
            } catch (error) {
              toast.error(
                getErrorMessage(error, t('ai.toast.translationAllFailed')),
              )
            }
          },
        },
      ],

      extraItemActions: (item) => [
        {
          id: 'retranslate',
          labelKey: 'ai.action.retranslate',
          icon: Languages,
          run: () =>
            createTranslationTask({
              refId: item.refId,
              targetLanguages: [item.lang],
            }),
        },
      ],

      getPreview: (item) =>
        [item.title, item.subtitle, item.summary, item.text]
          .filter(Boolean)
          .join('\n'),
      getLang: (item) => item.lang,
      getCreatedAt: (item) => item.createdAt,
      getId: (item) => item.id,

      EditDrawerBody: TranslationEditBody,
    }),
    [t],
  )

  return <ArticleGroupedRouteView<AITranslation> config={config} />
}
