import { Inject, Injectable } from '@nestjs/common'

import type { ArticleRefMap, TtsMeta } from '~/common/response/meta.types'
import { CollectionRefTypes } from '~/constants/db.constant'
import { NOTE_SERVICE_TOKEN } from '~/constants/injection.constant'
import type { PaginationResult } from '~/processors/database/base.repository'
import { DatabaseService } from '~/processors/database/database.service'

import { EntitlementService } from '../../membership/entitlement.service'
import type { NoteService } from '../../note/note.service'
import { isArticleVisibleToViewer } from '../ai-article-visibility.util'
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

export interface NarrationReader {
  isOwner?: boolean
  readerId?: string
  password?: string
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

function toSegments(
  blocks: AiTtsBlockRow[],
  blockOrder: string[],
): TtsSegmentResult[] {
  const rank = new Map(blockOrder.map((blockId, index) => [blockId, index]))
  return blocks
    .map((block) => ({
      blockId: block.blockId,
      chunkIndex: block.chunkIndex,
      text: block.text,
      url: block.url,
    }))
    .sort(
      (a, b) =>
        (rank.get(a.blockId) ?? Number.MAX_SAFE_INTEGER) -
          (rank.get(b.blockId) ?? Number.MAX_SAFE_INTEGER) ||
        a.blockId.localeCompare(b.blockId) ||
        a.chunkIndex - b.chunkIndex,
    )
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
    private readonly entitlementService: EntitlementService,
    @Inject(NOTE_SERVICE_TOKEN)
    private readonly noteService: NoteService,
  ) {}

  private async isVisibleToReader(
    article: { type: CollectionRefTypes; document: unknown },
    refId: string,
    reader: NarrationReader,
  ): Promise<boolean> {
    const hasNotePassword =
      article.type === CollectionRefTypes.Note &&
      (await this.noteService.checkPasswordToAccess(refId, reader.password))

    return isArticleVisibleToViewer(article, {
      isOwner: reader.isOwner,
      hasNotePassword,
    })
  }

  async getPublicNarration(
    refId: string,
    lang?: string,
    reader: NarrationReader = {},
  ): Promise<PublicNarrationResult | null> {
    const article = await this.databaseService.findGlobalById(refId)
    if (!article) return null
    if (!(await this.isVisibleToReader(article, refId, reader))) return null

    if (
      article.type === CollectionRefTypes.Post &&
      (await this.entitlementService.isPremiumLocked({
        isPremium: (article.document as { isPremium?: boolean | null })
          .isPremium,
        isOwner: Boolean(reader.isOwner),
        readerId: reader.readerId,
      }))
    ) {
      return null
    }

    const resolvedLang =
      lang ??
      parseLanguageCode(
        readArticleMetaLang(
          article.document as { meta?: Record<string, unknown> | null },
        ),
      )

    const parent = await this.repository.findByRefAndLang(refId, resolvedLang)
    if (!parent || parent.blockOrder.length === 0) return null

    const blocks = await this.repository.findBlocks(parent.id)
    return {
      lang: parent.lang,
      model: parent.model,
      voice: parent.voice,
      blockOrder: parent.blockOrder,
      segments: toSegments(blocks, parent.blockOrder),
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
        segments: toSegments(
          await this.repository.findBlocks(parent.id),
          parent.blockOrder,
        ),
      })),
    )
  }

  async list(query: {
    page?: number
    size?: number
  }): Promise<
    PaginationResult<NarrationListItemResult> & { articles: ArticleRefMap }
  > {
    const result = await this.repository.listPaginated(query)
    const data = result.data.map(toListItem)
    return {
      data,
      pagination: result.pagination,
      articles: await this.databaseService.getRefArticleMap(
        data.map((item) => item.refId),
      ),
    }
  }

  async getMetaForArticle(
    refId: string,
    lang: string,
    modifiedAt?: Date | null,
  ): Promise<TtsMeta> {
    const row = await this.repository.findMeta(refId, lang)
    // An empty block_order is the generation pipeline's "not published yet"
    // sentinel — the parent row exists but the run never finalized.
    if (!row || row.blockCount === 0) return { available: false }

    return {
      available: true,
      lang,
      blockCount: row.blockCount,
      stale: Boolean(
        modifiedAt &&
        row.sourceModifiedAt &&
        modifiedAt.getTime() > row.sourceModifiedAt.getTime(),
      ),
      updatedAt: row.updatedAt,
    }
  }
}
