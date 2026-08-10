import { AudioLines, FileText, Languages, Sparkles } from 'lucide-react'

import {
  createInsightsTask,
  createSummaryTask,
  createTranslationTask,
  createTtsTask,
} from '~/api/ai'
import type { CreateTaskResponse } from '~/api/tasks'
import { useI18n } from '~/i18n'
import type { ContextMenuItem } from '~/ui/overlay/context-menu'

import { presentGeneratePrompt } from '../components/article-grouped/GeneratePromptModal'
import { useAiDefaultLangs } from './use-ai-default-langs'
import { useAiGenerateTask } from './use-ai-generate-task'

export function useAiQuickActions(refId: string) {
  const { t } = useI18n()

  const mutation = useAiGenerateTask()
  const summaryDefaultLangs = useAiDefaultLangs('summaryTargetLanguages')
  const translationDefaultLangs = useAiDefaultLangs(
    'translationTargetLanguages',
  )

  const runWithLangPrompt = async (
    title: string,
    taskFn: (
      langs: string[] | undefined,
      force: boolean,
    ) => Promise<CreateTaskResponse>,
    options?: {
      defaultLangs?: string[]
      inlineEmpty?: string
      promptForLang?: boolean
    },
  ) => {
    const result = await presentGeneratePrompt({
      defaultLangs: options?.defaultLangs,
      inlineEmpty: options?.inlineEmpty,
      langLabel: t('ai.generate.langsLabel'),
      promptForLang: options?.promptForLang ?? true,
      title,
    })
    if (!result) return
    mutation.mutate(() =>
      taskFn(result.langs.length ? result.langs : undefined, result.force),
    )
  }

  const items: ContextMenuItem[] = [
    {
      icon: FileText,
      key: 'ai-summary',
      label: t('ai.menu.generateSummary'),
      onClick: () =>
        void runWithLangPrompt(
          t('ai.menu.generateSummary'),
          (langs, force) =>
            createSummaryTask({ force, refId, targetLanguages: langs }),
          { defaultLangs: summaryDefaultLangs },
        ),
    },
    {
      icon: Sparkles,
      key: 'ai-insights',
      label: t('ai.menu.generateInsights'),
      onClick: () =>
        void runWithLangPrompt(
          t('ai.menu.generateInsights'),
          (_langs, force) => createInsightsTask({ force, refId }),
          {
            inlineEmpty: t('ai.articleGrouped.inlineEmpty', {
              kind: t('ai.insights.kind'),
            }),
            promptForLang: false,
          },
        ),
    },
    {
      icon: Languages,
      key: 'ai-translation',
      label: t('ai.menu.generateTranslation'),
      onClick: () =>
        void runWithLangPrompt(
          t('ai.menu.generateTranslation'),
          (langs, force) =>
            createTranslationTask({ force, refId, targetLanguages: langs }),
          { defaultLangs: translationDefaultLangs },
        ),
    },
    {
      icon: AudioLines,
      key: 'ai-tts',
      label: t('ai.menu.generateTts'),
      onClick: () =>
        void runWithLangPrompt(t('ai.menu.generateTts'), (langs, force) =>
          createTtsTask({ force, langs, refId }),
        ),
    },
  ]

  return items
}
