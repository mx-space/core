import type { CreateTaskResponse } from '~/api/ai'
import {
  createInsightsTask,
  createInsightsTranslationTask,
  createSummaryTask,
  createSummaryTranslationTask,
  createTranslationTask,
  createTtsTask,
} from '~/api/ai'
import type { AiOverviewCapability, AiOverviewDetail } from '~/api/ai-overview'

/**
 * Summary and insights both derive translations from a source-language base
 * row, so a language is never generated on its own: the base task generates
 * (or reuses) the base and translates the requested targets from it. The only
 * shortcut is a single-language retry on an existing base — that goes through
 * the dedicated translation endpoint so forcing it does not force the base
 * row to regenerate too.
 */
function dispatchWithBase(
  rows: Array<{ isTranslation: boolean; lang: string }>,
  langs: string[] | undefined,
  createBase: () => Promise<CreateTaskResponse>,
  createTranslation: (targetLang: string) => Promise<CreateTaskResponse>,
) {
  const target = langs?.length === 1 ? langs[0] : undefined
  const base = rows.find((row) => !row.isTranslation)
  if (base && target && base.lang !== target) return createTranslation(target)
  return createBase()
}

export function buildGenerateTask(
  capability: AiOverviewCapability,
  langs: string[] | undefined,
  refId: string,
  detail: AiOverviewDetail,
  force: boolean,
) {
  switch (capability) {
    case 'summary': {
      return dispatchWithBase(
        detail.assets.summary,
        langs,
        () => createSummaryTask({ force, refId, targetLanguages: langs }),
        (targetLang) =>
          createSummaryTranslationTask({ force, refId, targetLang }),
      )
    }
    case 'insights': {
      return dispatchWithBase(
        detail.assets.insights,
        langs,
        () => createInsightsTask({ force, refId, targetLanguages: langs }),
        (targetLang) =>
          createInsightsTranslationTask({ force, refId, targetLang }),
      )
    }
    case 'translation': {
      return createTranslationTask({ force, refId, targetLanguages: langs })
    }
    case 'tts': {
      return createTtsTask({ force, langs, refId })
    }
  }
}
