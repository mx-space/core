import { createAiLogger } from '../environment'
import type { ArticleContent } from './article-content.types'
import {
  buildReusableTranslationOverlay,
  guardMermaidTranslations,
} from './lexical-block-reuse'
import { restoreLexicalTranslation } from './lexical-translation-parser'
import type { SourceMetaHashes } from './translation-meta'
import { encodeTags, isMetaFieldUnchanged } from './translation-meta'
import type {
  ExistingTranslation,
  LexicalDocumentAdapter,
} from './translation-strategy.types'
import { LEXICAL_CONTENT_FORMAT } from './translation-strategy.types'

export interface PartialLexicalTranslationStats {
  totalBlockCount: number
  changedBlockCount: number
  reusedBlockCount: number
  skippedReusableBlockCount: number
}

export interface PartialLexicalTranslationResult<
  T extends ExistingTranslation = ExistingTranslation,
> {
  translation: T
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

export class LexicalPartialTranslationBuilder {
  private readonly logger = createAiLogger(this.constructor.name)

  constructor(private readonly lexicalService: LexicalDocumentAdapter) {}

  build<T extends ExistingTranslation>(
    content: ArticleContent,
    existing: T,
  ): PartialLexicalTranslationResult<T> | null {
    if (content.contentFormat !== LEXICAL_CONTENT_FORMAT || !content.content) {
      return null
    }

    if (
      existing.contentFormat !== LEXICAL_CONTENT_FORMAT ||
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
          contentFormat: LEXICAL_CONTENT_FORMAT,
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
