import { AppErrorCode, createAppException } from '~/common/errors'
import { CollectionRefTypes } from '~/constants/db.constant'
import type { DatabaseService } from '~/processors/database/database.service'

import type { DraftRepository } from '../../draft/draft.repository'
import type { CoverStylePreset } from '../ai.prompts'
import { COVER_STYLE_PRESETS } from '../ai.prompts'

const COVER_ARTICLE_SUMMARY_MAX_LENGTH = 800

export interface CoverSubject {
  title: string
  summary: string
}

export interface CoverSubjectDeps {
  databaseService: DatabaseService
  draftRepository: DraftRepository
}

export interface CoverSubjectInput {
  draftId?: string
  refId?: string
  summary?: string
  title?: string
}

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
): Promise<CoverSubject> {
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

export async function resolveCoverSubject(
  deps: CoverSubjectDeps,
  input: CoverSubjectInput,
): Promise<CoverSubject> {
  const inline: CoverSubject = {
    title: input.title?.trim() ?? '',
    summary: input.summary?.trim() ?? '',
  }

  const draft = input.draftId
    ? await deps.draftRepository.findById(input.draftId)
    : null
  if (draft && (draft.title || draft.text)) {
    return {
      title: draft.title || inline.title,
      summary:
        draft.text?.slice(0, COVER_ARTICLE_SUMMARY_MAX_LENGTH) ||
        inline.summary,
    }
  }

  if (input.refId) return resolveCoverArticle(deps.databaseService, input.refId)

  if (inline.title && inline.summary) return inline

  throw createAppException(AppErrorCode.AI_INVALID_PARAMETER, {
    message: 'draftId, refId, or title with summary is required',
  })
}
