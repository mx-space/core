import { Plus, RefreshCw } from 'lucide-react'
import { useMemo } from 'react'

import type { AITtsRow } from '~/api/ai'
import {
  createTtsTask,
  deleteTts,
  getTtsByRefId,
  getTtsGrouped,
} from '~/api/ai'

import { ArticleGroupedRouteView } from '../components/article-grouped/ArticleGroupedRouteView'
import { TtsPlaybackBody } from '../components/article-grouped/TtsPlaybackBody'
import type { ArticleGroupedConfig } from '../components/article-grouped/types'
import { buildTtsRegeneratePayload } from '../utils/ai'

export function AiTtsRouteView() {
  const config = useMemo<ArticleGroupedConfig<AITtsRow>>(
    () => ({
      scopeIdPrefix: 'ai-tts',
      pageTitleKey: 'routes.aiTts.title',
      totalCountKey: 'ai.articleGrouped.totalCount',
      itemCountKey: 'ai.articleGrouped.itemCount',
      searchPlaceholderKey: 'ai.tts.searchPlaceholder',
      emptyTitleKey: 'ai.articleGrouped.emptyTitle',
      emptyDescriptionKey: 'ai.articleGrouped.emptyDescription',
      detailEmptyTitleKey: 'ai.tts.emptyTitle',
      detailEmptyDescriptionKey: 'ai.tts.emptyDescription',
      detailSectionTitleKey: 'ai.tts.detailSectionTitle',
      inlineEmptyKey: 'ai.articleGrouped.inlineEmpty',
      itemDeleteConfirmKey: 'ai.articleGrouped.confirmDelete',
      editTitleKey: 'ai.tts.playbackTitle',
      itemOpenLabelKey: 'ai.tts.openLabel',
      kindKey: 'ai.tts.kind',

      groupedQueryKey: 'tts',
      getGroupedPage: async (params) => {
        const response = await getTtsGrouped(params)
        return {
          data: response.data.map((group) => ({
            article: group.article,
            items: group.narrations,
          })),
          pagination: response.pagination,
        }
      },
      getItemsByRef: async (refId) => {
        const response = await getTtsByRefId(refId)
        return { article: response.article, items: response.rows }
      },
      deleteItem: deleteTts,
      // Narrations are read-only; the playback body never submits, so this
      // is never called.
      updateItem: () => Promise.resolve(),

      generate: {
        labelKey: 'ai.tts.generateLabel',
        icon: Plus,
        promptForLang: true,
        runTask: ({ refId, langs, force }) =>
          createTtsTask({
            force,
            langs: langs?.length ? langs : undefined,
            refId,
          }),
        taskTypeForQueue: 'Tts',
      },

      extraItemActions: (item) => [
        {
          id: 'regenerate',
          labelKey: 'ai.action.regenerate',
          icon: RefreshCw,
          run: () => createTtsTask(buildTtsRegeneratePayload(item)),
        },
      ],

      getPreview: (item) => item.segments[0]?.text ?? '',
      getLang: (item) => item.lang,
      getCreatedAt: (item) => item.updatedAt ?? '',
      getId: (item) => item.id,

      EditDrawerBody: TtsPlaybackBody,
    }),
    [],
  )

  return <ArticleGroupedRouteView<AITtsRow> config={config} />
}
