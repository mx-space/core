import {
  createInsightsTask,
  createInsightsTranslationTask,
  createSummaryTask,
  createTranslationTask,
  createTtsTask,
} from '~/api/ai'
import type { AiOverviewCapability, AiOverviewDetail } from '~/api/ai-overview'

/**
 * Insights translations are a separate endpoint that reads an existing
 * source-language row, so a target language can only be dispatched once a
 * non-translation row exists — without one the base task carries the request
 * as `targetLanguages` and the server chains the translation after it.
 */
export function buildGenerateTask(
  capability: AiOverviewCapability,
  langs: string[] | undefined,
  refId: string,
  detail: AiOverviewDetail,
  force: boolean,
) {
  switch (capability) {
    case 'summary': {
      return createSummaryTask({ force, refId, targetLanguages: langs })
    }
    case 'insights': {
      // An insights task has no language list of its own: a target is
      // requested one at a time, from a cell click or a single-language retry.
      const target = langs?.[0]
      const base = detail.assets.insights.find((row) => !row.isTranslation)
      if (!base) {
        return createInsightsTask({
          force,
          refId,
          targetLanguages: target ? [target] : undefined,
        })
      }
      if (!target || base.lang === target)
        return createInsightsTask({ force, refId })
      return createInsightsTranslationTask({ force, refId, targetLang: target })
    }
    case 'translation': {
      return createTranslationTask({ force, refId, targetLanguages: langs })
    }
    case 'tts': {
      return createTtsTask({ force, langs, refId })
    }
  }
}
