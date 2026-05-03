import { Injectable, Logger } from '@nestjs/common'
import DiffMatchPatch from 'diff-match-patch'

import { BizException } from '~/common/exceptions/biz.exception'
import { CollectionRefTypes } from '~/constants/db.constant'
import { ErrorCodeEnum } from '~/constants/error-code.constant'
import { DatabaseService } from '~/processors/database/database.service'
import {
  type LexicalRootBlock,
  LexicalService,
} from '~/processors/helper/helper.lexical.service'
import { ContentFormat } from '~/shared/types/content-format.type'
import { md5 } from '~/utils/tool.util'

import { AiTranslationRepository } from '../ai/ai-translation/ai-translation.repository'
import { CommentAnchorMode } from './comment.enum'
import { CommentRepository } from './comment.repository'
import type { CommentAnchorInput } from './comment.schema'
import type { CommentAnchorModel } from './comment.types'

const dmp = new DiffMatchPatch()

interface RefDocLike {
  contentFormat?: ContentFormat | string
  content?: string | null
}

@Injectable()
export class CommentAnchorService {
  private readonly logger: Logger = new Logger(CommentAnchorService.name)

  constructor(
    private readonly commentRepository: CommentRepository,
    private readonly aiTranslationRepository: AiTranslationRepository,
    private readonly databaseService: DatabaseService,
    private readonly lexicalService: LexicalService,
  ) {}

  findRangeByQuoteContext(
    text: string,
    quote: string,
    prefix = '',
    suffix = '',
  ): { startOffset: number; endOffset: number } | null {
    if (!quote) return null

    const indexes: number[] = []
    let cursor = 0
    while (cursor <= text.length - quote.length) {
      const index = text.indexOf(quote, cursor)
      if (index === -1) break
      indexes.push(index)
      cursor = index + 1
    }

    if (!indexes.length) return null

    const expectedPrefix = prefix || ''
    const expectedSuffix = suffix || ''

    const withContext = indexes.find((index) => {
      const left = text.slice(Math.max(0, index - expectedPrefix.length), index)
      const right = text.slice(
        index + quote.length,
        index + quote.length + expectedSuffix.length,
      )
      const prefixMatched = expectedPrefix ? left === expectedPrefix : true
      const suffixMatched = expectedSuffix ? right === expectedSuffix : true
      return prefixMatched && suffixMatched
    })

    const picked = withContext ?? (indexes.length === 1 ? indexes[0] : null)
    if (picked == null) {
      return null
    }

    return {
      startOffset: picked,
      endOffset: picked + quote.length,
    }
  }

  projectRangeFromSnapshot(
    snapshotText: string,
    currentText: string,
    startOffset: number,
    endOffset: number,
  ): { startOffset: number; endOffset: number } | null {
    const safeStart = Math.max(0, Math.min(startOffset, snapshotText.length))
    const safeEnd = Math.max(
      safeStart,
      Math.min(endOffset, snapshotText.length),
    )
    const selected = snapshotText.slice(safeStart, safeEnd)
    if (!selected) return null

    const patches = dmp.patch_make(snapshotText, currentText)
    const [projectedPrefix, prefixFlags] = dmp.patch_apply(
      patches,
      snapshotText.slice(0, safeStart),
    )
    const [projectedSelection, selectionFlags] = dmp.patch_apply(
      patches,
      snapshotText.slice(0, safeEnd),
    )

    if (
      !prefixFlags.every(Boolean) ||
      !selectionFlags.every(Boolean) ||
      typeof projectedPrefix !== 'string' ||
      typeof projectedSelection !== 'string'
    ) {
      return null
    }

    const nextStart = projectedPrefix.length
    const nextEnd = projectedSelection.length

    if (nextEnd < nextStart || nextEnd > currentText.length) {
      return null
    }

    return {
      startOffset: nextStart,
      endOffset: nextEnd,
    }
  }

  findBlockByAnchor(
    anchor: {
      blockId?: string
      blockFingerprint?: string
      blockType?: string
      snapshotText?: string
    },
    blocks: LexicalRootBlock[],
  ): LexicalRootBlock | null {
    const blockById = blocks.find((block) => block.id === anchor.blockId)
    if (blockById) {
      return blockById
    }

    const byFingerprint = blocks.find((block) => {
      if (!anchor.blockFingerprint) return false
      if (block.fingerprint !== anchor.blockFingerprint) return false
      if (anchor.blockType && block.type !== anchor.blockType) return false
      return true
    })
    if (byFingerprint) {
      return byFingerprint
    }

    if (anchor.blockType) {
      const bySnapshot = blocks.find(
        (block) =>
          block.type === anchor.blockType && block.text === anchor.snapshotText,
      )
      if (bySnapshot) {
        return bySnapshot
      }
    }

    return null
  }

  async resolveAnchorForCreate(
    anchorInput: CommentAnchorInput | undefined,
    refDoc: RefDocLike & { _id?: any; id?: string },
  ): Promise<CommentAnchorModel | undefined> {
    if (!anchorInput) {
      return undefined
    }
    // The Zod discriminated union narrowing is brittle across versions; treat
    // the validated payload as the loose flat shape during resolution.
    const anchor = anchorInput as {
      mode: CommentAnchorMode
      blockId?: string
      blockType?: string
      blockFingerprint?: string
      snapshotText?: string
      lang?: string | null
      quote?: string
      prefix?: string
      suffix?: string
      startOffset?: number
      endOffset?: number
    }

    const refDocId =
      (refDoc.id as string | undefined) ||
      (refDoc.id ? String(refDoc.id) : undefined)

    let lexicalContent: string | undefined

    if (anchor.lang && refDocId) {
      const translation = await this.aiTranslationRepository.findByRefAndLang(
        refDocId,
        anchor.lang,
      )

      if (
        translation?.contentFormat === ContentFormat.Lexical &&
        translation.content &&
        typeof translation.content === 'string'
      ) {
        lexicalContent = translation.content
      }
    }

    if (!lexicalContent) {
      if (
        refDoc.contentFormat !== ContentFormat.Lexical ||
        !refDoc.content ||
        typeof refDoc.content !== 'string'
      ) {
        throw new BizException(
          ErrorCodeEnum.InvalidParameter,
          'Anchor comments are only supported for lexical content.',
        )
      }
      lexicalContent = refDoc.content
    }

    const blocks = this.lexicalService.extractRootBlocks(lexicalContent)
    const block = this.findBlockByAnchor(anchor, blocks)
    if (!block || !block.id) {
      throw new BizException(
        ErrorCodeEnum.InvalidParameter,
        'Cannot find the anchor block in current lexical document.',
      )
    }

    const now = new Date()
    const contentHash = md5(lexicalContent)
    const langField = anchor.lang ?? undefined

    if (anchor.mode === CommentAnchorMode.Block) {
      return {
        mode: CommentAnchorMode.Block,
        blockId: block.id,
        blockType: block.type,
        blockFingerprint: block.fingerprint,
        snapshotText: block.text,
        contentHashAtCreate: contentHash,
        contentHashCurrent: contentHash,
        lastResolvedAt: now,
        lang: langField,
      }
    }

    const quote = anchor.quote
    if (!quote) {
      throw new BizException(
        ErrorCodeEnum.InvalidParameter,
        'Range anchor quote cannot be empty.',
      )
    }

    const initialSlice = block.text.slice(anchor.startOffset, anchor.endOffset)

    const range =
      initialSlice === quote
        ? {
            startOffset: anchor.startOffset,
            endOffset: anchor.endOffset,
          }
        : this.findRangeByQuoteContext(
            block.text,
            quote,
            anchor.prefix,
            anchor.suffix,
          )

    if (!range) {
      throw new BizException(
        ErrorCodeEnum.InvalidParameter,
        'Cannot resolve selected text in current block.',
      )
    }

    return {
      mode: CommentAnchorMode.Range,
      blockId: block.id,
      blockType: block.type,
      blockFingerprint: block.fingerprint,
      snapshotText: block.text,
      quote,
      prefix: anchor.prefix ?? '',
      suffix: anchor.suffix ?? '',
      startOffset: range.startOffset,
      endOffset: range.endOffset,
      contentHashAtCreate: contentHash,
      contentHashCurrent: contentHash,
      lastResolvedAt: now,
      lang: langField,
    }
  }

  resolveAnchorForUpdatedContent(
    anchor: CommentAnchorModel,
    blocks: LexicalRootBlock[],
    contentHash: string,
  ): CommentAnchorModel | null {
    const targetBlock = this.findBlockByAnchor(anchor, blocks)
    if (!targetBlock || !targetBlock.id) {
      return null
    }

    const baseAnchor = {
      ...anchor,
      blockId: targetBlock.id,
      blockType: targetBlock.type,
      blockFingerprint: targetBlock.fingerprint,
      snapshotText: targetBlock.text,
      contentHashCurrent: contentHash,
      lastResolvedAt: new Date(),
    }

    if (anchor.mode === CommentAnchorMode.Block) {
      return {
        ...baseAnchor,
        mode: CommentAnchorMode.Block,
      }
    }

    const quote = anchor.quote
    if (!quote) {
      return null
    }

    const currentSlice = targetBlock.text.slice(
      anchor.startOffset ?? 0,
      anchor.endOffset ?? 0,
    )

    let range =
      currentSlice === quote
        ? {
            startOffset: anchor.startOffset ?? 0,
            endOffset: anchor.endOffset ?? 0,
          }
        : this.findRangeByQuoteContext(
            targetBlock.text,
            quote,
            anchor.prefix ?? '',
            anchor.suffix ?? '',
          )

    if (!range && typeof anchor.snapshotText === 'string') {
      const projected = this.projectRangeFromSnapshot(
        anchor.snapshotText,
        targetBlock.text,
        anchor.startOffset ?? 0,
        anchor.endOffset ?? 0,
      )
      if (
        projected &&
        targetBlock.text.slice(projected.startOffset, projected.endOffset) ===
          quote
      ) {
        range = projected
      }
    }

    if (!range) {
      range = this.findRangeByQuoteContext(targetBlock.text, quote)
    }

    if (!range) {
      return null
    }

    return {
      ...baseAnchor,
      mode: CommentAnchorMode.Range,
      quote,
      prefix: anchor.prefix ?? '',
      suffix: anchor.suffix ?? '',
      startOffset: range.startOffset,
      endOffset: range.endOffset,
    }
  }

  /**
   * Re-anchor comments after the underlying document content changed.
   *
   * TODO(post-merge): port the reanchor flow once CommentRepository exposes
   * findRootCommentsWithAnchor + bulk update + cascade delete on PG. The
   * mongoose bulkWrite/deleteMany version lived on master pre-cutover; we
   * stub here so document edits do not regress, and because the comment
   * anchor feature is itself gated behind newer admin tooling.
   */
  async reanchorCommentsByRef(
    refType: CollectionRefTypes,
    refId: string,
  ): Promise<void> {
    if (!refId) return
    void refType
    void this.databaseService
    void this.commentRepository
    void this.lexicalService
    void md5
    this.logger.debug(`reanchorCommentsByRef(${refType}, ${refId}) skipped`)
  }
}
