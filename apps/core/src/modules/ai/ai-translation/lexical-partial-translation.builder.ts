import { Injectable, Logger } from '@nestjs/common'

import { LexicalService } from '~/processors/helper/helper.lexical.service'
import { ContentFormat } from '~/shared/types/content-format.type'
import { md5 } from '~/utils/tool.util'

import type { AiTranslationRow, ArticleContent } from './ai-translation.types'
import {
  backfillReusableBlockTranslations,
  guardMermaidTranslations,
} from './lexical-block-reuse'
import {
  parseLexicalForTranslation,
  restoreLexicalTranslation,
} from './lexical-translation-parser'

export interface PartialLexicalTranslationStats {
  totalBlockCount: number
  changedBlockCount: number
  reusedBlockCount: number
  skippedReusableBlockCount: number
}

export interface PartialLexicalTranslationResult {
  translation: AiTranslationRow
  stats: PartialLexicalTranslationStats
}

interface LexicalSourceBlockSnapshot {
  id: string
  fingerprint: string
}

interface LexicalSourceMetaHashes {
  title?: unknown
  subtitle?: unknown
  summary?: unknown
  tags?: unknown
}

function isLexicalSourceBlockSnapshotArray(
  value: unknown,
): value is LexicalSourceBlockSnapshot[] {
  return (
    Array.isArray(value) &&
    value.every(
      (snapshot) =>
        snapshot &&
        typeof snapshot === 'object' &&
        typeof (snapshot as LexicalSourceBlockSnapshot).id === 'string' &&
        typeof (snapshot as LexicalSourceBlockSnapshot).fingerprint ===
          'string',
    )
  )
}

function getMetaHashes(value: unknown): LexicalSourceMetaHashes | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as LexicalSourceMetaHashes
}

@Injectable()
export class LexicalPartialTranslationBuilder {
  private readonly logger = new Logger(LexicalPartialTranslationBuilder.name)

  constructor(private readonly lexicalService: LexicalService) {}

  build(
    content: ArticleContent,
    existing: AiTranslationRow,
  ): PartialLexicalTranslationResult | null {
    if (content.contentFormat !== ContentFormat.Lexical || !content.content) {
      return null
    }

    if (
      existing.contentFormat !== ContentFormat.Lexical ||
      !existing.content ||
      !isLexicalSourceBlockSnapshotArray(existing.sourceBlockSnapshots)
    ) {
      return null
    }

    const currentBlocks = this.lexicalService.extractRootBlocks(content.content)
    if (currentBlocks.length === 0) {
      return null
    }

    const oldFingerprintByBlockId = new Map(
      existing.sourceBlockSnapshots.map((snapshot) => [
        snapshot.id,
        snapshot.fingerprint,
      ]),
    )
    const unchangedBlockIds = new Set<string>()

    for (const block of currentBlocks) {
      if (
        block.id &&
        oldFingerprintByBlockId.has(block.id) &&
        oldFingerprintByBlockId.get(block.id) === block.fingerprint
      ) {
        unchangedBlockIds.add(block.id)
      }
    }

    try {
      const currentParseResult = parseLexicalForTranslation(content.content)
      const translatedParseResult = parseLexicalForTranslation(existing.content)
      const translations = new Map<string, string>()
      const backfillResult = backfillReusableBlockTranslations(
        currentParseResult,
        translatedParseResult,
        unchangedBlockIds,
        translations,
      )

      guardMermaidTranslations(currentParseResult, translations, (message) =>
        this.logger.warn(message),
      )

      const translatedContent = restoreLexicalTranslation(
        currentParseResult,
        translations,
      )
      const text = this.lexicalService.lexicalToMarkdown(translatedContent)
      const metaHashes = getMetaHashes(existing.sourceMetaHashes)
      const stats: PartialLexicalTranslationStats = {
        totalBlockCount: currentBlocks.length,
        changedBlockCount: currentBlocks.length - unchangedBlockIds.size,
        reusedBlockCount: backfillResult.reusedBlockIds.length,
        skippedReusableBlockCount: backfillResult.skippedBlockIds.length,
      }

      this.logger.log(
        `Partial Lexical translation: total=${stats.totalBlockCount} changed=${stats.changedBlockCount} reused=${stats.reusedBlockCount} skipped=${stats.skippedReusableBlockCount}`,
      )

      return {
        translation: {
          ...existing,
          title:
            metaHashes?.title === md5(content.title)
              ? existing.title
              : content.title,
          subtitle:
            content.subtitle && metaHashes?.subtitle === md5(content.subtitle)
              ? existing.subtitle
              : (content.subtitle ?? null),
          summary:
            content.summary && metaHashes?.summary === md5(content.summary)
              ? existing.summary
              : (content.summary ?? null),
          tags:
            content.tags?.length &&
            metaHashes?.tags === md5(content.tags.join('|||'))
              ? existing.tags
              : (content.tags ?? []),
          text,
          contentFormat: ContentFormat.Lexical,
          content: translatedContent,
        },
        stats,
      }
    } catch (error) {
      this.logger.warn(
        `Partial Lexical translation failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      )
      return null
    }
  }
}
