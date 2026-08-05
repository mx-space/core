import { Injectable } from '@nestjs/common'

import { CollectionRefTypes } from '~/constants/db.constant'
import type { PaginationResult } from '~/processors/database/base.repository'
import { DatabaseService } from '~/processors/database/database.service'

import { isGlobalArticleVisible } from '../ai-article-visibility.util'
import { parseLanguageCode } from '../ai-language.util'
import { readArticleMetaLang } from '../ai-translation/article-content.util'
import { AiTtsRepository } from './ai-tts.repository'
import type { AiTtsBlockRow, AiTtsRow } from './ai-tts.types'

export interface TtsSegmentResult {
  blockId: string
  chunkIndex: number
  text: string
  url: string
}

export interface PublicNarrationResult {
  lang: string
  model: string
  voice: string
  blockOrder: string[]
  segments: TtsSegmentResult[]
}

export interface NarrationDetailResult {
  id: string
  lang: string
  isTranslation: boolean
  model: string
  voice: string
  speed: number
  blockOrder: string[]
  charCount: number
  updatedAt: Date | null
  segments: TtsSegmentResult[]
}

export interface NarrationListItemResult {
  id: string
  refId: string
  lang: string
  blockCount: number
  charCount: number
  updatedAt: Date | null
}

function toSegments(blocks: AiTtsBlockRow[]): TtsSegmentResult[] {
  return blocks.map((block) => ({
    blockId: block.blockId,
    chunkIndex: block.chunkIndex,
    text: block.text,
    url: block.url,
  }))
}

function toListItem(row: AiTtsRow): NarrationListItemResult {
  return {
    id: row.id,
    refId: row.refId,
    lang: row.lang,
    blockCount: row.blockOrder.length,
    charCount: row.charCount,
    updatedAt: row.updatedAt,
  }
}

@Injectable()
export class AiTtsQueryService {
  constructor(
    private readonly repository: AiTtsRepository,
    private readonly databaseService: DatabaseService,
  ) {}

  private isPremiumLocked(article: {
    type: CollectionRefTypes
    document: unknown
  }): boolean {
    return (
      article.type === CollectionRefTypes.Post &&
      Boolean((article.document as { isPremium?: boolean | null }).isPremium)
    )
  }

  async getPublicNarration(
    refId: string,
    lang?: string,
  ): Promise<PublicNarrationResult | null> {
    const article = await this.databaseService.findGlobalById(refId)
    if (!article || !isGlobalArticleVisible(article)) return null
    if (this.isPremiumLocked(article)) return null

    const resolvedLang =
      lang ??
      parseLanguageCode(
        readArticleMetaLang(
          article.document as { meta?: Record<string, unknown> | null },
        ),
      )

    const parent = await this.repository.findByRefAndLang(refId, resolvedLang)
    if (!parent) return null

    const blocks = await this.repository.findBlocks(parent.id)
    return {
      lang: parent.lang,
      model: parent.model,
      voice: parent.voice,
      blockOrder: parent.blockOrder,
      segments: toSegments(blocks),
    }
  }

  async getDetailsByRefId(refId: string): Promise<NarrationDetailResult[]> {
    const parents = await this.repository.findAllByRef(refId)
    return Promise.all(
      parents.map(async (parent) => ({
        id: parent.id,
        lang: parent.lang,
        isTranslation: parent.isTranslation,
        model: parent.model,
        voice: parent.voice,
        speed: parent.speed,
        blockOrder: parent.blockOrder,
        charCount: parent.charCount,
        updatedAt: parent.updatedAt,
        segments: toSegments(await this.repository.findBlocks(parent.id)),
      })),
    )
  }

  async list(query: {
    page?: number
    size?: number
  }): Promise<PaginationResult<NarrationListItemResult>> {
    const result = await this.repository.listPaginated(query)
    return {
      data: result.data.map(toListItem),
      pagination: result.pagination,
    }
  }
}
