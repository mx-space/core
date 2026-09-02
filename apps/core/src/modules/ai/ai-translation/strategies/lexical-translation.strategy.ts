import { Injectable } from '@nestjs/common'

import { LexicalService } from '~/processors/helper/helper.lexical.service'
import { ContentFormat } from '~/shared/types/content-format.type'
import { extractDocumentContext } from '~/utils/content.util'

import type { IModelRuntime } from '../../runtime'
import type { ArticleContent } from '../ai-translation.types'
import type { AITranslationModel } from '../ai-translation.types-model'
import { runTranslationAgent } from '../engine/translation-agent'
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
import type { TranslationUnit } from '../translation-unit.types'
import {
  unitsToEntries,
  unitsToMeta,
  unitsToSourceMap,
} from '../translation-unit.types'
import {
  BaseTranslationStrategy,
  emptyEditorMetrics,
  emptyReviewerMetrics,
} from './base-translation-strategy'

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
      metrics,
      styleHints,
    } = options
    const isLexical = content.contentFormat === ContentFormat.Lexical
    const existingBlockSnapshots = existing?.sourceBlockSnapshots as
      LexicalSourceBlockSnapshot[] | undefined
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
          metrics,
          push,
          onCost,
          styleHints,
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
      metrics,
      push,
      onCost,
      styleHints,
    )
  }

  private async runReviewAndEdit(
    targetLang: string,
    translatorRuntime: IModelRuntime,
    reviewerRuntime: IModelRuntime,
    allTranslations: Map<string, string>,
    writtenIds: readonly string[],
    sources: Record<string, string>,
    signal?: AbortSignal,
    metrics?: PipelineMetrics,
    styleHints?: string,
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
      sources,
      allowedIds: writtenIds,
      signal,
      metrics,
      styleHints,
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

  private async translateViaAgent(
    targetLang: string,
    args: {
      units: TranslationUnit[]
      documentContext: string
      styleHints?: string
    },
    allTranslations: Map<string, string>,
    runtime: IModelRuntime,
    options: {
      reviewerRuntime?: IModelRuntime
      signal?: AbortSignal
      onToken?: (count?: number) => Promise<void>
      onCost?: (usd: number) => Promise<void>
      metrics?: PipelineMetrics
      push?: TranslationStrategyOptions['push']
    },
  ): Promise<string> {
    const { reviewerRuntime, signal, onToken, onCost, metrics, push } = options
    const seen = new Set<string>()
    const result = await runTranslationAgent({
      targetLang,
      units: args.units,
      documentContext: args.documentContext,
      styleHints: args.styleHints,
      runtime,
      reviewerRuntime,
      signal,
      onToken,
      onCost,
      metrics,
      onSegments: push
        ? async (segments) => {
            for (const [segmentId, value] of Object.entries(segments)) {
              if (seen.has(segmentId)) continue
              seen.add(segmentId)
              await push({
                type: 'partial',
                data: { lang: targetLang, segmentId, partial: value },
              })
            }
          }
        : undefined,
    })
    for (const [id, text] of result.translations) {
      allTranslations.set(id, text)
    }
    return result.sourceLang
  }

  private async translateFull(
    content: ArticleContent,
    targetLang: string,
    runtime: IModelRuntime,
    info: { model: string; provider: string },
    onToken?: (count?: number) => Promise<void>,
    signal?: AbortSignal,
    reviewerRuntime?: IModelRuntime,
    metrics?: PipelineMetrics,
    push?: TranslationStrategyOptions['push'],
    onCost?: (usd: number) => Promise<void>,
    styleHints?: string,
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

    let sourceLang: string
    if (typeof runtime.streamMessage === 'function') {
      sourceLang = await this.translateViaAgent(
        targetLang,
        { units: allUnits, documentContext, styleHints },
        allTranslations,
        runtime,
        { reviewerRuntime, signal, onToken, onCost, metrics, push },
      )
    } else {
      const writerStart = Date.now()
      sourceLang = await this.translateAllUnits(
        targetLang,
        {
          documentContext,
          units: allUnits,
          styleHints,
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
          unitsToSourceMap(allUnits),
          signal,
          metrics,
          styleHints,
        )
      } else if (metrics) {
        metrics.reviewer = emptyReviewerMetrics('review-disabled')
        metrics.editor = emptyEditorMetrics('review-disabled')
      }
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
    metrics?: PipelineMetrics,
    push?: TranslationStrategyOptions['push'],
    onCost?: (usd: number) => Promise<void>,
    styleHints?: string,
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
      SourceMetaHashes | null | undefined

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

    if (typeof runtime.streamMessage === 'function') {
      const sl = await this.translateViaAgent(
        targetLang,
        { units: allUnits, documentContext: callContext, styleHints },
        allTranslations,
        runtime,
        { reviewerRuntime, signal, onToken, onCost, metrics, push },
      )
      if (sl) sourceLang = sl
    } else {
      const writerStart = Date.now()
      const sl = await this.translateAllUnits(
        targetLang,
        {
          documentContext: callContext,
          units: allUnits,
          styleHints,
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
          unitsToSourceMap(allUnits),
          signal,
          metrics,
          styleHints,
        )
      } else if (metrics) {
        metrics.reviewer = emptyReviewerMetrics(
          reviewerRuntime ? 'full-reuse' : 'review-disabled',
        )
        metrics.editor = emptyEditorMetrics(
          reviewerRuntime ? 'full-reuse' : 'review-disabled',
        )
      }
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
    return units
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
      styleHints?: string
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
        textEntries: unitsToEntries(units),
        segmentMeta: unitsToMeta(units),
        styleHints: ctx.styleHints,
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
            textEntries: unitsToEntries(retryUnits),
            segmentMeta: unitsToMeta(retryUnits),
            styleHints: ctx.styleHints,
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
