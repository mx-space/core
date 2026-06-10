import { Injectable } from '@nestjs/common'

import { LexicalService } from '~/processors/helper/helper.lexical.service'
import { ContentFormat } from '~/shared/types/content-format.type'
import { extractDocumentContext } from '~/utils/content.util'

import type { IModelRuntime } from '../../runtime'
import type { ArticleContent } from '../ai-translation.types'
import type { AITranslationModel } from '../ai-translation.types-model'
import {
  buildReusableTranslationOverlay,
  guardMermaidTranslations,
} from '../lexical-block-reuse'
import {
  parseLexicalForTranslation,
  restoreLexicalTranslation,
  type TranslationSegment,
} from '../lexical-translation-parser'
import { TranslationReviewerService } from '../reviewer.service'
import {
  decodeTags,
  encodeTags,
  isMetaFieldUnchanged,
  META_SUBTITLE_KEY,
  META_SUMMARY_KEY,
  META_TAGS_KEY,
  META_TITLE_KEY,
  type SourceMetaHashes,
} from '../translation-meta'
import type {
  ITranslationStrategy,
  PipelineMetrics,
  TranslationResult,
  TranslationStrategyOptions,
} from '../translation-strategy.interface'
import {
  BaseTranslationStrategy,
  DEFAULT_REVIEW_SCORE_THRESHOLD,
  emptyEditorMetrics,
  emptyReviewerMetrics,
} from './base-translation-strategy'

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

interface LexicalSourceBlockSnapshot {
  id: string
  fingerprint: string
  type?: string
  index?: number
  [key: string]: unknown
}

const GROUP_UNIT_PREFIX = '__inline_group__'

@Injectable()
export class LexicalTranslationStrategy
  extends BaseTranslationStrategy
  implements ITranslationStrategy
{
  constructor(
    private readonly lexicalService: LexicalService,
    private readonly reviewerService: TranslationReviewerService,
  ) {
    super(LexicalTranslationStrategy.name)
  }

  async translate(
    content: ArticleContent,
    targetLang: string,
    runtime: IModelRuntime,
    info: { model: string; provider: string },
    options: TranslationStrategyOptions,
  ): Promise<TranslationResult> {
    const {
      push,
      onToken,
      onCost,
      signal,
      existing,
      reviewerRuntime,
      reviewScoreThreshold,
      metrics,
    } = options
    const isLexical = content.contentFormat === ContentFormat.Lexical
    const existingBlockSnapshots = existing?.sourceBlockSnapshots as
      | LexicalSourceBlockSnapshot[]
      | undefined
    const canIncremental =
      isLexical && existing?.content && existingBlockSnapshots?.length

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
          reviewerRuntime,
          reviewScoreThreshold,
          metrics,
          push,
          onCost,
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
      reviewerRuntime,
      reviewScoreThreshold,
      metrics,
      push,
      onCost,
    )
  }

  private async runReviewAndEdit(
    targetLang: string,
    translatorRuntime: IModelRuntime,
    reviewerRuntime: IModelRuntime,
    allTranslations: Map<string, string>,
    writtenIds: readonly string[],
    scoreThreshold: number,
    signal?: AbortSignal,
    metrics?: PipelineMetrics,
  ): Promise<void> {
    if (writtenIds.length === 0) {
      if (metrics) {
        metrics.reviewer = emptyReviewerMetrics('no-changed-segments')
        metrics.editor = emptyEditorMetrics('no-changed-segments')
      }
      return
    }

    const fullTranslations: Record<string, string> = {}
    for (const [id, text] of allTranslations) {
      fullTranslations[id] = text
    }

    const allowedSet = new Set(writtenIds)
    await this.runReviewAndEditPipeline({
      targetLang,
      translatorRuntime,
      reviewerRuntime,
      reviewerService: this.reviewerService,
      fullTranslations,
      allowedIds: writtenIds,
      scoreThreshold,
      signal,
      metrics,
      applyPatches: (rawPatches) => {
        const patchKeysApplied: string[] = []
        const patchKeysDropped: string[] = []
        const patches: Array<{ id: string; before: string; after: string }> = []
        for (const [id, patched] of Object.entries(rawPatches)) {
          if (allowedSet.has(id) && allTranslations.has(id)) {
            const before = allTranslations.get(id) ?? ''
            allTranslations.set(id, patched)
            patchKeysApplied.push(id)
            patches.push({ id, before, after: patched })
          } else {
            patchKeysDropped.push(id)
          }
        }
        return { patchKeysApplied, patchKeysDropped, patches }
      },
    })
  }

  private async translateFull(
    content: ArticleContent,
    targetLang: string,
    runtime: IModelRuntime,
    info: { model: string; provider: string },
    onToken?: (count?: number) => Promise<void>,
    signal?: AbortSignal,
    reviewerRuntime?: IModelRuntime,
    reviewScoreThreshold?: number,
    metrics?: PipelineMetrics,
    push?: TranslationStrategyOptions['push'],
    onCost?: (usd: number) => Promise<void>,
  ): Promise<TranslationResult> {
    const parseResult = parseLexicalForTranslation(content.content!)
    const { segments, propertySegments, editorState } = parseResult
    const allTranslations = new Map<string, string>()
    const contentUnits = this.buildContentTranslationUnits(
      segments,
      propertySegments,
    )
    const metaUnits = this.buildMetaTranslationUnits(content)
    const allUnits = [...metaUnits, ...contentUnits]
    const documentContext = contentUnits.length
      ? extractDocumentContext(editorState.root?.children ?? [])
      : content.title

    const writerStart = Date.now()
    const sourceLang = await this.translateAllUnits(
      targetLang,
      {
        documentContext,
        units: allUnits,
      },
      allTranslations,
      runtime,
      onToken,
      signal,
      push,
      targetLang,
      onCost,
    )
    if (metrics) metrics.writerMs = Date.now() - writerStart

    if (reviewerRuntime) {
      const writtenIds = Array.from(allTranslations.keys())
      await this.runReviewAndEdit(
        targetLang,
        runtime,
        reviewerRuntime,
        allTranslations,
        writtenIds,
        reviewScoreThreshold ?? DEFAULT_REVIEW_SCORE_THRESHOLD,
        signal,
        metrics,
      )
    } else if (metrics) {
      metrics.reviewer = emptyReviewerMetrics('review-disabled')
      metrics.editor = emptyEditorMetrics('review-disabled')
    }

    guardMermaidTranslations(parseResult, allTranslations, (message) =>
      this.logger.warn(message),
    )

    const translatedContent = restoreLexicalTranslation(
      parseResult,
      allTranslations,
    )
    const title = allTranslations.get(META_TITLE_KEY) ?? content.title
    const subtitle =
      allTranslations.get(META_SUBTITLE_KEY) ?? content.subtitle ?? null
    const summary =
      allTranslations.get(META_SUMMARY_KEY) ?? content.summary ?? null
    const tagsStr = allTranslations.get(META_TAGS_KEY)
    const tags = tagsStr ? decodeTags(tagsStr) : (content.tags ?? null)

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
    reviewerRuntime?: IModelRuntime,
    reviewScoreThreshold?: number,
    metrics?: PipelineMetrics,
    push?: TranslationStrategyOptions['push'],
    onCost?: (usd: number) => Promise<void>,
  ): Promise<TranslationResult> {
    const currentBlocks = this.lexicalService.extractRootBlocks(
      content.content!,
    )
    const oldSnapshots =
      existing.sourceBlockSnapshots as LexicalSourceBlockSnapshot[]

    let overlay: ReturnType<typeof buildReusableTranslationOverlay>
    try {
      overlay = buildReusableTranslationOverlay(
        content.content!,
        existing.content!,
        currentBlocks,
        oldSnapshots,
      )
    } catch {
      throw new Error('Failed to parse existing translated content')
    }

    const { parseResult, translations: allTranslations } = overlay
    const { segments, propertySegments, editorState } = parseResult
    const removedMetaKeys = new Set<string>()
    let sourceLang = existing.sourceLang || ''

    this.logger.log(
      `Incremental diff: totalBlocks=${currentBlocks.length} changed=${currentBlocks.length - overlay.unchangedBlockIds.size} reused=${overlay.unchangedBlockIds.size}`,
    )
    this.logger.log(
      `Incremental reuse: reused=${overlay.backfill.reusedBlockIds.length} skipped=${overlay.backfill.skippedBlockIds.length}`,
    )

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
    const oldMetaHashes = existing.sourceMetaHashes as
      | SourceMetaHashes
      | null
      | undefined

    if (!isMetaFieldUnchanged(oldMetaHashes, 'title', content.title)) {
      metaUnits.push({
        id: META_TITLE_KEY,
        payload: content.title,
        meta: 'meta.title',
      })
    } else {
      allTranslations.set(META_TITLE_KEY, existing.title)
    }

    if (content.subtitle) {
      if (!isMetaFieldUnchanged(oldMetaHashes, 'subtitle', content.subtitle)) {
        metaUnits.push({
          id: META_SUBTITLE_KEY,
          payload: content.subtitle,
          meta: 'meta.subtitle',
        })
      } else if (existing.subtitle) {
        allTranslations.set(META_SUBTITLE_KEY, existing.subtitle)
      }
    } else if (oldMetaHashes?.subtitle || existing.subtitle) {
      removedMetaKeys.add(META_SUBTITLE_KEY)
    }

    if (content.summary) {
      if (!isMetaFieldUnchanged(oldMetaHashes, 'summary', content.summary)) {
        metaUnits.push({
          id: META_SUMMARY_KEY,
          payload: content.summary,
          meta: 'meta.summary',
        })
      } else if (existing.summary) {
        allTranslations.set(META_SUMMARY_KEY, existing.summary)
      }
    } else if (oldMetaHashes?.summary || existing.summary) {
      removedMetaKeys.add(META_SUMMARY_KEY)
    }

    if (content.tags?.length) {
      const encodedTags = encodeTags(content.tags)
      if (!isMetaFieldUnchanged(oldMetaHashes, 'tags', encodedTags)) {
        metaUnits.push({
          id: META_TAGS_KEY,
          payload: encodedTags,
          meta: 'meta.tags',
        })
      } else if (existing.tags?.length) {
        allTranslations.set(META_TAGS_KEY, encodeTags(existing.tags))
      }
    } else if (oldMetaHashes?.tags || existing.tags?.length) {
      removedMetaKeys.add(META_TAGS_KEY)
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
        title: allTranslations.get(META_TITLE_KEY) ?? existing.title,
        text: this.lexicalService.lexicalToMarkdown(translatedContent),
        contentFormat: ContentFormat.Lexical,
        content: translatedContent,
        subtitle: this.resolveOptionalMeta(
          META_SUBTITLE_KEY,
          removedMetaKeys,
          allTranslations,
          existing.subtitle,
        ),
        summary: this.resolveOptionalMeta(
          META_SUMMARY_KEY,
          removedMetaKeys,
          allTranslations,
          existing.summary,
        ),
        tags: removedMetaKeys.has(META_TAGS_KEY)
          ? null
          : (existing.tags ?? null),
        aiModel: info.model,
        aiProvider: info.provider,
      }
    }

    const writtenIdsBeforeCall = new Set(allTranslations.keys())
    const allUnits = [...metaUnits, ...contentUnits]
    const callContext = contentUnits.length ? documentContext : content.title

    const writerStart = Date.now()
    const sl = await this.translateAllUnits(
      targetLang,
      {
        documentContext: callContext,
        units: allUnits,
      },
      allTranslations,
      runtime,
      onToken,
      signal,
      push,
      targetLang,
      onCost,
    )
    if (metrics) metrics.writerMs = Date.now() - writerStart
    if (sl) sourceLang = sl

    const writtenIds = Array.from(allTranslations.keys()).filter(
      (id) => !writtenIdsBeforeCall.has(id),
    )

    if (reviewerRuntime && writtenIds.length > 0) {
      await this.runReviewAndEdit(
        targetLang,
        runtime,
        reviewerRuntime,
        allTranslations,
        writtenIds,
        reviewScoreThreshold ?? DEFAULT_REVIEW_SCORE_THRESHOLD,
        signal,
        metrics,
      )
    } else if (metrics) {
      metrics.reviewer = emptyReviewerMetrics(
        reviewerRuntime ? 'full-reuse' : 'review-disabled',
      )
      metrics.editor = emptyEditorMetrics(
        reviewerRuntime ? 'full-reuse' : 'review-disabled',
      )
    }

    guardMermaidTranslations(parseResult, allTranslations, (message) =>
      this.logger.warn(message),
    )

    const translatedContent = restoreLexicalTranslation(
      parseResult,
      allTranslations,
    )
    const title = allTranslations.get(META_TITLE_KEY) ?? existing.title
    const subtitle = this.resolveOptionalMeta(
      META_SUBTITLE_KEY,
      removedMetaKeys,
      allTranslations,
      existing.subtitle,
    )
    const summary = this.resolveOptionalMeta(
      META_SUMMARY_KEY,
      removedMetaKeys,
      allTranslations,
      existing.summary,
    )
    const tags = this.resolveTagsMeta(
      removedMetaKeys,
      allTranslations,
      existing.tags ?? content.tags ?? null,
    )

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

  private resolveOptionalMeta(
    key: string,
    removedMetaKeys: Set<string>,
    allTranslations: Map<string, string>,
    fallback: string | null | undefined,
  ): string | null {
    if (removedMetaKeys.has(key)) return null
    return allTranslations.get(key) ?? fallback ?? null
  }

  private resolveTagsMeta(
    removedMetaKeys: Set<string>,
    allTranslations: Map<string, string>,
    fallback: string[] | null,
  ): string[] | null {
    if (removedMetaKeys.has(META_TAGS_KEY)) return null
    const tagsStr = allTranslations.get(META_TAGS_KEY)
    if (tagsStr) return decodeTags(tagsStr)
    return fallback
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
        meta: this.resolvePropertyUnitMeta(prop),
      })
    }

    return units
  }

  private resolvePropertyUnitMeta(prop: {
    property: string
    node: any
  }): string {
    if (prop.property === 'reading' && prop.node?.type === 'ruby') {
      return 'ruby.reading'
    }
    if (prop.property === 'diagram' && prop.node?.type === 'mermaid') {
      return 'mermaid.diagram'
    }
    return `property.${prop.property}`
  }

  private buildMetaTranslationUnits(
    content: ArticleContent,
  ): TranslationUnit[] {
    const units: TranslationUnit[] = [
      { id: META_TITLE_KEY, payload: content.title, meta: 'meta.title' },
    ]

    if (content.subtitle) {
      units.push({
        id: META_SUBTITLE_KEY,
        payload: content.subtitle,
        meta: 'meta.subtitle',
      })
    }
    if (content.summary) {
      units.push({
        id: META_SUMMARY_KEY,
        payload: content.summary,
        meta: 'meta.summary',
      })
    }
    if (content.tags?.length) {
      units.push({
        id: META_TAGS_KEY,
        payload: encodeTags(content.tags),
        meta: 'meta.tags',
      })
    }

    return units
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

  private async translateAllUnits(
    targetLang: string,
    ctx: {
      documentContext: string
      units: TranslationUnit[]
    },
    output: Map<string, string>,
    runtime: IModelRuntime,
    onToken?: (count?: number) => Promise<void>,
    signal?: AbortSignal,
    push?: TranslationStrategyOptions['push'],
    lang?: string,
    onCost?: (usd: number) => Promise<void>,
  ): Promise<string> {
    const { documentContext, units } = ctx
    if (units.length === 0) return ''

    const seenUnitIds = new Set<string>()
    const onPartial = push
      ? async (partial: unknown) => {
          if (
            !partial ||
            typeof partial !== 'object' ||
            Array.isArray(partial)
          ) {
            return
          }
          const translations = (partial as { translations?: unknown })
            .translations
          if (
            !translations ||
            typeof translations !== 'object' ||
            Array.isArray(translations)
          ) {
            return
          }
          for (const [unitId, value] of Object.entries(
            translations as Record<string, unknown>,
          )) {
            if (value === undefined) continue
            if (seenUnitIds.has(unitId)) continue
            seenUnitIds.add(unitId)
            await push({
              type: 'partial',
              data: {
                lang: lang ?? targetLang,
                segmentId: unitId,
                partial: value,
              },
            })
          }
        }
      : undefined

    const result = await this.callWriterStreaming(
      targetLang,
      {
        documentContext,
        textEntries: this.unitsToEntries(units),
        segmentMeta: this.unitsToMeta(units),
      },
      runtime,
      onPartial,
      onToken,
      signal,
      onCost,
    )

    const sourceLang = result.sourceLang
    const unresolvedUnitIds = this.resolveUnitTranslations(
      units,
      result.translations,
      output,
    )

    if (unresolvedUnitIds.length > 0) {
      const retryUnits = units.filter((unit) =>
        unresolvedUnitIds.includes(unit.id),
      )
      try {
        const retryResult = await this.callWriter(
          targetLang,
          {
            documentContext,
            textEntries: this.unitsToEntries(retryUnits),
            segmentMeta: this.unitsToMeta(retryUnits),
          },
          runtime,
          onToken,
          signal,
          onCost,
        )
        this.resolveUnitTranslations(
          retryUnits,
          retryResult.translations,
          output,
        )

        const stillMissing = retryUnits.filter((unit) => {
          if (unit.memberIds?.length) {
            return unit.memberIds.some((memberId) => !output.has(memberId))
          }
          return !output.has(unit.id)
        })

        for (const unit of stillMissing) {
          this.logger.warn(
            `Translation missing for unit ${unit.id} after retry, falling back to original`,
          )
        }
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error)
        for (const unit of retryUnits) {
          this.logger.warn(
            `Translation retry failed for unit ${unit.id} (${reason}), falling back to original`,
          )
        }
      }
    }

    return sourceLang
  }
}
