import { Injectable } from '@nestjs/common'

import { LexicalService } from '~/processors/helper/helper.lexical.service'
import { ContentFormat } from '~/shared/types/content-format.type'
import { throwIfAborted } from '~/utils/abort.util'
import { extractDocumentContext } from '~/utils/content.util'
import { md5 } from '~/utils/tool.util'

import type { IModelRuntime } from '../../runtime'
import type { AITranslationModel } from '../ai-translation.model'
import type { ArticleContent } from '../ai-translation.types'
import {
  type LexicalTranslationResult,
  parseLexicalForTranslation,
  type PropertySegment,
  restoreLexicalTranslation,
  type TranslationSegment,
} from '../lexical-translation-parser'
import type {
  ITranslationStrategy,
  TranslationResult,
  TranslationStrategyOptions,
} from '../translation-strategy.interface'
import { BaseTranslationStrategy } from './base-translation-strategy'

interface TranslationUnit {
  id: string
  payload:
    | string
    | {
        type: 'text.group'
        segments: Array<{ id: string; text: string }>
      }
  meta: string
  memberIds?: string[]
}

interface BlockTranslationSegments {
  segments: TranslationSegment[]
  propertySegments: PropertySegment[]
}

const GROUP_UNIT_PREFIX = '__inline_group__'
const REMOVED_SUBTITLE_KEY = '__subtitle__'
const REMOVED_SUMMARY_KEY = '__summary__'
const REMOVED_TAGS_KEY = '__tags__'

@Injectable()
export class LexicalTranslationStrategy
  extends BaseTranslationStrategy
  implements ITranslationStrategy
{
  constructor(private readonly lexicalService: LexicalService) {
    super(LexicalTranslationStrategy.name)
  }

  async translate(
    content: ArticleContent,
    targetLang: string,
    runtime: IModelRuntime,
    info: { model: string; provider: string },
    options: TranslationStrategyOptions,
  ): Promise<TranslationResult> {
    const { onToken, signal, existing } = options
    const isLexical = content.contentFormat === ContentFormat.Lexical
    const canIncremental =
      isLexical && existing?.content && existing.sourceBlockSnapshots?.length

    if (canIncremental) {
      try {
        this.logger.log(`Incremental translation path: target=${targetLang}`)
        return await this.translateIncremental(
          content,
          targetLang,
          runtime,
          info,
          existing!,
          onToken,
          signal,
        )
      } catch (error: any) {
        if (error.name === 'AbortError') throw error
        this.logger.warn(
          `Incremental translation failed, falling back to full: ${error.message}`,
        )
      }
    }

    this.logger.log(`Full translation path: target=${targetLang}`)
    return this.translateFull(
      content,
      targetLang,
      runtime,
      info,
      onToken,
      signal,
    )
  }

  private async translateFull(
    content: ArticleContent,
    targetLang: string,
    runtime: IModelRuntime,
    info: { model: string; provider: string },
    onToken?: (count?: number) => Promise<void>,
    signal?: AbortSignal,
  ): Promise<TranslationResult> {
    const parseResult = parseLexicalForTranslation(content.content!)
    const { segments, propertySegments, editorState } = parseResult
    const allTranslations = new Map<string, string>()
    let sourceLang: string
    const contentUnits = this.buildContentTranslationUnits(
      segments,
      propertySegments,
    )
    const metaUnits = this.buildMetaTranslationUnits(content)

    if (contentUnits.length === 0) {
      const result = await this.callChunkTranslation(
        targetLang,
        {
          documentContext: content.title,
          textEntries: this.unitsToEntries(metaUnits),
          segmentMeta: this.unitsToMeta(metaUnits),
        },
        runtime,
        onToken,
        signal,
      )
      sourceLang = result.sourceLang
      for (const [id, text] of Object.entries(result.translations)) {
        if (typeof text === 'string') {
          allTranslations.set(id, text)
        }
      }
    } else {
      const documentContext = extractDocumentContext(
        editorState.root?.children ?? [],
      )
      sourceLang = await this.translateChunkedUnits(
        targetLang,
        {
          documentContext,
          contentUnits,
          metaUnits,
        },
        allTranslations,
        runtime,
        onToken,
        signal,
      )
    }

    const translatedContent = restoreLexicalTranslation(
      parseResult,
      allTranslations,
    )
    const title = allTranslations.get('__title__') ?? content.title
    const subtitle =
      allTranslations.get('__subtitle__') ?? content.subtitle ?? null
    const summary =
      allTranslations.get('__summary__') ?? content.summary ?? null
    const tagsStr = allTranslations.get('__tags__')
    const tags = tagsStr ? tagsStr.split('|||') : (content.tags ?? null)

    return {
      sourceLang,
      title,
      text: this.lexicalService.lexicalToMarkdown(translatedContent),
      contentFormat: ContentFormat.Lexical,
      content: translatedContent,
      subtitle,
      summary,
      tags,
      aiModel: info.model,
      aiProvider: info.provider,
    }
  }

  private async translateIncremental(
    content: ArticleContent,
    targetLang: string,
    runtime: IModelRuntime,
    info: { model: string; provider: string },
    existing: AITranslationModel,
    onToken?: (count?: number) => Promise<void>,
    signal?: AbortSignal,
  ): Promise<TranslationResult> {
    const currentBlocks = this.lexicalService.extractRootBlocks(
      content.content!,
    )
    const oldSnapshots = existing.sourceBlockSnapshots!
    const oldFpMap = new Map(oldSnapshots.map((s) => [s.id, s.fingerprint]))

    const changedBlockIds = new Set<string | null>()
    const unchangedBlockIds = new Set<string>()

    for (const block of currentBlocks) {
      if (
        block.id &&
        oldFpMap.has(block.id) &&
        oldFpMap.get(block.id) === block.fingerprint
      ) {
        unchangedBlockIds.add(block.id)
      } else {
        changedBlockIds.add(block.id)
      }
    }

    this.logger.log(
      `Incremental diff: totalBlocks=${currentBlocks.length} changed=${changedBlockIds.size} reused=${unchangedBlockIds.size}`,
    )

    const parseResult = parseLexicalForTranslation(content.content!)
    const { segments, propertySegments, editorState } = parseResult
    const allTranslations = new Map<string, string>()
    const removedMetaKeys = new Set<string>()
    let sourceLang = existing.sourceLang || ''

    try {
      const translatedParseResult = parseLexicalForTranslation(
        existing.content!,
      )
      this.backfillReusableBlockTranslations(
        parseResult,
        translatedParseResult,
        unchangedBlockIds,
        allTranslations,
      )
    } catch {
      throw new Error('Failed to parse existing translated content')
    }

    const documentContext = extractDocumentContext(
      editorState.root?.children ?? [],
    )
    const changedSegments = segments.filter((seg) => {
      if (!seg.translatable) return false
      if (!seg.blockId) return true
      return !allTranslations.has(seg.id)
    })
    const changedPropertySegments = propertySegments.filter((prop) => {
      if (!prop.blockId) return true
      return !allTranslations.has(prop.id)
    })
    const contentUnits = this.buildContentTranslationUnits(
      changedSegments,
      changedPropertySegments,
    )

    const metaUnits: TranslationUnit[] = []
    const oldMetaHashes = existing.sourceMetaHashes

    const currentTitleHash = md5(content.title)
    if (!oldMetaHashes || oldMetaHashes.title !== currentTitleHash) {
      metaUnits.push({
        id: '__title__',
        payload: content.title,
        meta: 'meta.title',
      })
    } else {
      allTranslations.set('__title__', existing.title)
    }

    if (content.subtitle) {
      const currentSubtitleHash = md5(content.subtitle)
      if (!oldMetaHashes || oldMetaHashes.subtitle !== currentSubtitleHash) {
        metaUnits.push({
          id: REMOVED_SUBTITLE_KEY,
          payload: content.subtitle,
          meta: 'meta.subtitle',
        })
      } else if (existing.subtitle) {
        allTranslations.set(REMOVED_SUBTITLE_KEY, existing.subtitle)
      }
    } else if (oldMetaHashes?.subtitle || existing.subtitle) {
      removedMetaKeys.add(REMOVED_SUBTITLE_KEY)
    }

    if (content.summary) {
      const currentSummaryHash = md5(content.summary)
      if (!oldMetaHashes || oldMetaHashes.summary !== currentSummaryHash) {
        metaUnits.push({
          id: REMOVED_SUMMARY_KEY,
          payload: content.summary,
          meta: 'meta.summary',
        })
      } else if (existing.summary) {
        allTranslations.set(REMOVED_SUMMARY_KEY, existing.summary)
      }
    } else if (oldMetaHashes?.summary || existing.summary) {
      removedMetaKeys.add(REMOVED_SUMMARY_KEY)
    }

    if (content.tags?.length) {
      const currentTagsHash = md5(content.tags.join('|||'))
      if (!oldMetaHashes || oldMetaHashes.tags !== currentTagsHash) {
        metaUnits.push({
          id: REMOVED_TAGS_KEY,
          payload: content.tags.join('|||'),
          meta: 'meta.tags',
        })
      } else if (existing.tags?.length) {
        allTranslations.set(REMOVED_TAGS_KEY, existing.tags.join('|||'))
      }
    } else if (oldMetaHashes?.tags || existing.tags?.length) {
      removedMetaKeys.add(REMOVED_TAGS_KEY)
    }

    const totalEntries = contentUnits.length + metaUnits.length

    this.logger.log(
      `Incremental entries: content=${contentUnits.length} meta=${metaUnits.length} total=${totalEntries}`,
    )

    if (totalEntries === 0) {
      const translatedContent = restoreLexicalTranslation(
        parseResult,
        allTranslations,
      )
      return {
        sourceLang,
        title: allTranslations.get('__title__') ?? existing.title,
        text: this.lexicalService.lexicalToMarkdown(translatedContent),
        contentFormat: ContentFormat.Lexical,
        content: translatedContent,
        subtitle: removedMetaKeys.has(REMOVED_SUBTITLE_KEY)
          ? null
          : (allTranslations.get(REMOVED_SUBTITLE_KEY) ??
            existing.subtitle ??
            null),
        summary: removedMetaKeys.has(REMOVED_SUMMARY_KEY)
          ? null
          : (allTranslations.get(REMOVED_SUMMARY_KEY) ??
            existing.summary ??
            null),
        tags: removedMetaKeys.has(REMOVED_TAGS_KEY)
          ? null
          : (existing.tags ?? null),
        aiModel: info.model,
        aiProvider: info.provider,
      }
    }

    if (contentUnits.length === 0) {
      const result = await this.callChunkTranslation(
        targetLang,
        {
          documentContext: content.title,
          textEntries: this.unitsToEntries(metaUnits),
          segmentMeta: this.unitsToMeta(metaUnits),
        },
        runtime,
        onToken,
        signal,
      )
      if (result.sourceLang) sourceLang = result.sourceLang
      for (const [id, text] of Object.entries(result.translations)) {
        if (typeof text === 'string') {
          allTranslations.set(id, text)
        }
      }
    } else {
      const sl = await this.translateChunkedUnits(
        targetLang,
        {
          documentContext,
          contentUnits,
          metaUnits,
        },
        allTranslations,
        runtime,
        onToken,
        signal,
      )
      if (sl) sourceLang = sl
    }

    const translatedContent = restoreLexicalTranslation(
      parseResult,
      allTranslations,
    )
    const title = allTranslations.get('__title__') ?? existing.title
    const subtitle = removedMetaKeys.has(REMOVED_SUBTITLE_KEY)
      ? null
      : (allTranslations.get(REMOVED_SUBTITLE_KEY) ?? existing.subtitle ?? null)
    const summary = removedMetaKeys.has(REMOVED_SUMMARY_KEY)
      ? null
      : (allTranslations.get(REMOVED_SUMMARY_KEY) ?? existing.summary ?? null)
    const tagsStr = removedMetaKeys.has(REMOVED_TAGS_KEY)
      ? undefined
      : allTranslations.get(REMOVED_TAGS_KEY)
    const tags = tagsStr
      ? tagsStr.split('|||')
      : removedMetaKeys.has(REMOVED_TAGS_KEY)
        ? null
        : (existing.tags ?? content.tags ?? null)

    return {
      sourceLang,
      title,
      text: this.lexicalService.lexicalToMarkdown(translatedContent),
      contentFormat: ContentFormat.Lexical,
      content: translatedContent,
      subtitle,
      summary,
      tags,
      aiModel: info.model,
      aiProvider: info.provider,
    }
  }

  private buildContentTranslationUnits(
    segments: TranslationSegment[],
    propertySegments: Array<{
      id: string
      text: string
      property: string
      node: any
    }>,
  ): TranslationUnit[] {
    const units: TranslationUnit[] = []
    let groupIndex = 0
    let pendingGroup: TranslationSegment[] = []

    const flushGroup = () => {
      if (pendingGroup.length === 0) return
      if (pendingGroup.length === 1) {
        const [segment] = pendingGroup
        units.push({
          id: segment.id,
          payload: segment.text,
          meta: 'text',
        })
      } else {
        units.push({
          id: `${GROUP_UNIT_PREFIX}_${groupIndex++}`,
          payload: {
            type: 'text.group',
            segments: pendingGroup.map((segment) => ({
              id: segment.id,
              text: segment.text,
            })),
          },
          meta: 'text.group',
          memberIds: pendingGroup.map((segment) => segment.id),
        })
      }
      pendingGroup = []
    }

    for (const segment of segments) {
      if (!segment.translatable) {
        flushGroup()
        continue
      }

      if (!segment.flowId) {
        flushGroup()
        units.push({
          id: segment.id,
          payload: segment.text,
          meta: 'text',
        })
        continue
      }

      if (
        pendingGroup.length > 0 &&
        pendingGroup[0].flowId !== segment.flowId
      ) {
        flushGroup()
      }

      pendingGroup.push(segment)
    }

    flushGroup()

    for (const prop of propertySegments) {
      units.push({
        id: prop.id,
        payload: prop.text,
        meta:
          prop.property === 'reading' && prop.node?.type === 'ruby'
            ? 'ruby.reading'
            : `property.${prop.property}`,
      })
    }

    return units
  }

  private buildMetaTranslationUnits(
    content: ArticleContent,
  ): TranslationUnit[] {
    const units: TranslationUnit[] = [
      { id: '__title__', payload: content.title, meta: 'meta.title' },
    ]

    if (content.subtitle) {
      units.push({
        id: '__subtitle__',
        payload: content.subtitle,
        meta: 'meta.subtitle',
      })
    }
    if (content.summary) {
      units.push({
        id: '__summary__',
        payload: content.summary,
        meta: 'meta.summary',
      })
    }
    if (content.tags?.length) {
      units.push({
        id: '__tags__',
        payload: content.tags.join('|||'),
        meta: 'meta.tags',
      })
    }

    return units
  }

  private groupSegmentsByBlock(
    result: LexicalTranslationResult,
  ): Map<string, BlockTranslationSegments> {
    const byBlock = new Map<string, BlockTranslationSegments>()

    const getBucket = (blockId: string) => {
      let bucket = byBlock.get(blockId)
      if (!bucket) {
        bucket = { segments: [], propertySegments: [] }
        byBlock.set(blockId, bucket)
      }
      return bucket
    }

    for (const segment of result.segments) {
      if (!segment.blockId || !segment.translatable) continue
      getBucket(segment.blockId).segments.push(segment)
    }

    for (const propertySegment of result.propertySegments) {
      if (!propertySegment.blockId) continue
      getBucket(propertySegment.blockId).propertySegments.push(propertySegment)
    }

    return byBlock
  }

  private canReuseBlockTranslations(
    currentBlock: BlockTranslationSegments,
    translatedBlock: BlockTranslationSegments,
  ): boolean {
    if (currentBlock.segments.length !== translatedBlock.segments.length) {
      return false
    }

    if (
      currentBlock.propertySegments.length !==
      translatedBlock.propertySegments.length
    ) {
      return false
    }

    return currentBlock.propertySegments.every((segment, index) => {
      const translatedSegment = translatedBlock.propertySegments[index]
      return (
        translatedSegment.property === segment.property &&
        translatedSegment.key === segment.key
      )
    })
  }

  private backfillReusableBlockTranslations(
    currentResult: LexicalTranslationResult,
    translatedResult: LexicalTranslationResult,
    unchangedBlockIds: Set<string>,
    output: Map<string, string>,
  ): void {
    const currentBlocks = this.groupSegmentsByBlock(currentResult)
    const translatedBlocks = this.groupSegmentsByBlock(translatedResult)

    for (const blockId of unchangedBlockIds) {
      const currentBlock = currentBlocks.get(blockId)
      const translatedBlock = translatedBlocks.get(blockId)

      if (!currentBlock || !translatedBlock) continue
      if (!this.canReuseBlockTranslations(currentBlock, translatedBlock)) {
        continue
      }

      currentBlock.segments.forEach((segment, index) => {
        output.set(segment.id, translatedBlock.segments[index].text)
      })

      currentBlock.propertySegments.forEach((propertySegment, index) => {
        output.set(
          propertySegment.id,
          translatedBlock.propertySegments[index].text,
        )
      })
    }
  }

  private unitsToEntries(units: TranslationUnit[]): Record<string, unknown> {
    return Object.fromEntries(units.map((unit) => [unit.id, unit.payload]))
  }

  private unitsToMeta(units: TranslationUnit[]): Record<string, string> {
    return Object.fromEntries(units.map((unit) => [unit.id, unit.meta]))
  }

  private parseGroupedTranslation(
    translated: unknown,
    memberIds: string[],
  ): Record<string, string> | null {
    if (
      !translated ||
      typeof translated !== 'object' ||
      Array.isArray(translated)
    ) {
      return null
    }

    const result: Record<string, string> = {}
    for (const memberId of memberIds) {
      const value = (translated as Record<string, unknown>)[memberId]
      if (typeof value !== 'string') {
        return null
      }
      result[memberId] = value
    }

    return result
  }

  private getUnitTokenText(unit: TranslationUnit): string {
    return typeof unit.payload === 'string'
      ? unit.payload
      : unit.payload.segments.map((segment) => segment.text).join('')
  }

  private resolveUnitTranslations(
    units: TranslationUnit[],
    translations: Record<string, string | Record<string, string>>,
    output: Map<string, string>,
  ): string[] {
    const unresolvedUnitIds: string[] = []

    for (const unit of units) {
      const translated = translations[unit.id]
      if (translated === undefined) {
        unresolvedUnitIds.push(unit.id)
        continue
      }

      if (!unit.memberIds?.length) {
        if (typeof translated !== 'string') {
          unresolvedUnitIds.push(unit.id)
          continue
        }
        output.set(unit.id, translated)
        continue
      }

      const parsed = this.parseGroupedTranslation(translated, unit.memberIds)
      if (!parsed) {
        unresolvedUnitIds.push(unit.id)
        continue
      }

      for (const [memberId, memberText] of Object.entries(parsed)) {
        output.set(memberId, memberText)
      }
    }

    return unresolvedUnitIds
  }

  private async translateChunkedUnits(
    targetLang: string,
    ctx: {
      documentContext: string
      contentUnits: TranslationUnit[]
      metaUnits: TranslationUnit[]
    },
    output: Map<string, string>,
    runtime: IModelRuntime,
    onToken?: (count?: number) => Promise<void>,
    signal?: AbortSignal,
  ): Promise<string> {
    const { documentContext, contentUnits, metaUnits } = ctx
    const allTranslations = output
    let sourceLang = ''
    const MAX_BATCH_TOKENS = 4000
    const estimateTokens = (text: string) => Math.ceil(text.length / 3)

    const batches: TranslationUnit[][] = []
    let currentBatch = [...metaUnits]
    let currentTokens = metaUnits.reduce(
      (sum, unit) => sum + estimateTokens(this.getUnitTokenText(unit)),
      0,
    )
    let hasContentUnit = false

    for (const unit of contentUnits) {
      const tokens = estimateTokens(this.getUnitTokenText(unit))
      if (hasContentUnit && currentTokens + tokens > MAX_BATCH_TOKENS) {
        batches.push(currentBatch)
        currentBatch = []
        currentTokens = 0
      }
      currentBatch.push(unit)
      currentTokens += tokens
      hasContentUnit = true
    }

    if (currentBatch.length > 0) {
      batches.push(currentBatch)
    }

    for (const batch of batches) {
      throwIfAborted(signal)
      const result = await this.callChunkTranslation(
        targetLang,
        {
          documentContext,
          textEntries: this.unitsToEntries(batch),
          segmentMeta: this.unitsToMeta(batch),
        },
        runtime,
        onToken,
        signal,
      )
      if (!sourceLang) sourceLang = result.sourceLang

      const unresolvedUnitIds = this.resolveUnitTranslations(
        batch,
        result.translations,
        allTranslations,
      )

      if (unresolvedUnitIds.length > 0) {
        const retryUnits = batch.filter((unit) =>
          unresolvedUnitIds.includes(unit.id),
        )
        try {
          const retryResult = await this.callChunkTranslation(
            targetLang,
            {
              documentContext,
              textEntries: this.unitsToEntries(retryUnits),
              segmentMeta: this.unitsToMeta(retryUnits),
            },
            runtime,
            onToken,
            signal,
          )
          this.resolveUnitTranslations(
            retryUnits,
            retryResult.translations,
            allTranslations,
          )

          const stillMissing = retryUnits.filter((unit) => {
            if (unit.memberIds?.length) {
              return unit.memberIds.some(
                (memberId) => !allTranslations.has(memberId),
              )
            }
            return !allTranslations.has(unit.id)
          })

          for (const unit of stillMissing) {
            this.logger.warn(
              `Translation missing for unit ${unit.id} after retry, falling back to original`,
            )
          }
        } catch {
          for (const unit of retryUnits) {
            this.logger.warn(
              `Translation retry failed for unit ${unit.id}, falling back to original`,
            )
          }
        }
      }
    }

    return sourceLang
  }
}
