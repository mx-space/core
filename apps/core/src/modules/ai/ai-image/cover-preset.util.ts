import { AppErrorCode, createAppException } from '~/common/errors'
import { CollectionRefTypes } from '~/constants/db.constant'
import type { DatabaseService } from '~/processors/database/database.service'

import type { CoverStylePreset } from '../ai.prompts'
import { COVER_STYLE_PRESETS } from '../ai.prompts'

const COVER_ARTICLE_SUMMARY_MAX_LENGTH = 800

export function resolveCoverPreset(presetId: string): CoverStylePreset {
  const preset = COVER_STYLE_PRESETS[presetId]
  if (!preset) {
    throw createAppException(AppErrorCode.AI_INVALID_PARAMETER, {
      message: `Unknown cover preset: ${presetId}`,
    })
  }
  return preset
}

export async function resolveCoverArticle(
  databaseService: DatabaseService,
  refId: string,
): Promise<{ title: string; summary: string }> {
  const article = await databaseService.findGlobalById(refId)
  if (!article || article.type === CollectionRefTypes.Recently) {
    throw createAppException(AppErrorCode.CONTENT_NOT_FOUND_CANT_PROCESS)
  }

  const { document } = article
  const summary =
    'summary' in document && document.summary
      ? document.summary
      : (document.text?.slice(0, COVER_ARTICLE_SUMMARY_MAX_LENGTH) ?? '')

  return { title: document.title, summary }
}
