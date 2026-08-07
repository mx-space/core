import { useMutation } from '@tanstack/react-query'
import { AudioLines, FileText, Languages, Sparkles } from 'lucide-react'
import { toast } from 'sonner'

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
import { getErrorMessage } from '../utils/ai'

export function useAiQuickActions(refId: string) {
  const { t } = useI18n()

  const mutation = useMutation({
    mutationFn: async (fn: () => Promise<CreateTaskResponse>) => fn(),
    onError: (error: unknown) =>
      toast.error(getErrorMessage(error, t('ai.toast.taskCreateFailed'))),
    onSuccess: (result) => {
      toast.success(
        result.created ? t('ai.toast.taskCreated') : t('ai.toast.taskExists'),
      )
    },
  })

  const runWithLangPrompt = async (
    title: string,
    taskFn: (lang: string) => Promise<CreateTaskResponse>,
  ) => {
    const result = await presentGeneratePrompt({
      langLabel: t('ai.translation.langLabel'),
      promptForLang: true,
      title,
    })
    if (!result) return
    const lang = result.lang?.trim().toLowerCase() ?? 'zh'
    if (!lang) return
    mutation.mutate(() => taskFn(lang))
  }

  const items: ContextMenuItem[] = [
    {
      icon: FileText,
      key: 'ai-summary',
      label: t('ai.menu.generateSummary'),
      onClick: () =>
        void runWithLangPrompt(t('ai.menu.generateSummary'), (lang) =>
          createSummaryTask({ refId, lang }),
        ),
    },
    {
      icon: Sparkles,
      key: 'ai-insights',
      label: t('ai.menu.generateInsights'),
      onClick: () => mutation.mutate(() => createInsightsTask({ refId })),
    },
    {
      icon: Languages,
      key: 'ai-translation',
      label: t('ai.menu.generateTranslation'),
      onClick: () =>
        void runWithLangPrompt(t('ai.menu.generateTranslation'), (lang) =>
          createTranslationTask({ refId, targetLanguages: [lang] }),
        ),
    },
    {
      icon: AudioLines,
      key: 'ai-tts',
      label: t('ai.menu.generateTts'),
      onClick: () =>
        void runWithLangPrompt(t('ai.menu.generateTts'), (lang) =>
          createTtsTask({ refId, langs: [lang] }),
        ),
    },
  ]

  return items
}
