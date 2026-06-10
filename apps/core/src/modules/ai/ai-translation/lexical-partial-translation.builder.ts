import { Injectable, Logger } from '@nestjs/common'

import { LexicalService } from '~/processors/helper/helper.lexical.service'
import { ContentFormat } from '~/shared/types/content-format.type'

import type { AiTranslationRow, ArticleContent } from './ai-translation.types'
import {
  buildReusableTranslationOverlay,
  guardMermaidTranslations,
} from './lexical-block-reuse'
import { restoreLexicalTranslation } from './lexical-translation-parser'
import {
  encodeTags,
  isMetaFieldUnchanged,
  type SourceMetaHashes,
} from './translation-meta'

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

function getMetaHashes(value: unknown): SourceMetaHashes | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as SourceMetaHashes
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

    try {
      const {
        parseResult: currentParseResult,
        translations,
        backfill: backfillResult,
      } = buildReusableTranslationOverlay(
        content.content,
        existing.content,
        currentBlocks,
        existing.sourceBlockSnapshots,
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
        changedBlockCount:
          currentBlocks.length - backfillResult.reusedBlockIds.length,
        reusedBlockCount: backfillResult.reusedBlockIds.length,
        skippedReusableBlockCount: backfillResult.skippedBlockIds.length,
      }

      this.logger.log(
        `Partial Lexical translation: total=${stats.totalBlockCount} changed=${stats.changedBlockCount} reused=${stats.reusedBlockCount} skipped=${stats.skippedReusableBlockCount}`,
      )

      return {
        translation: {
          ...existing,
          title: isMetaFieldUnchanged(metaHashes, 'title', content.title)
            ? existing.title
            : content.title,
          subtitle:
            content.subtitle &&
            isMetaFieldUnchanged(metaHashes, 'subtitle', content.subtitle)
              ? existing.subtitle
              : (content.subtitle ?? null),
          summary:
            content.summary &&
            isMetaFieldUnchanged(metaHashes, 'summary', content.summary)
              ? existing.summary
              : (content.summary ?? null),
          tags:
            content.tags?.length &&
            isMetaFieldUnchanged(metaHashes, 'tags', encodeTags(content.tags))
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
