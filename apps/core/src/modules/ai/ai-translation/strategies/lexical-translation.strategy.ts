import { Injectable } from '@nestjs/common'

import {
  BLOCK_ID_STATE_KEY,
  NODE_STATE_KEY,
} from '~/constants/lexical.constant'
import { LexicalService } from '~/processors/helper/helper.lexical.service'
import { ContentFormat } from '~/shared/types/content-format.type'
import { md5 } from '~/utils/tool.util'

import type { IModelRuntime } from '../../runtime'
import type { AITranslationModel } from '../ai-translation.model'
import type { ArticleContent } from '../ai-translation.types'
import {
  extractDocumentContext,
  parseLexicalForTranslation,
  restoreLexicalTranslation,
} from '../lexical-translation-parser'
import type {
  ITranslationStrategy,
  TranslationResult,
  TranslationStrategyOptions,
} from '../translation-strategy.interface'
import { BaseTranslationStrategy } from './base-translation-strategy'

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

    const allEntries: Record<string, string> = {}
    const allEntryMeta: Record<string, string> = {}
    for (const seg of segments) {
      if (seg.translatable) {
        allEntries[seg.id] = seg.text
        allEntryMeta[seg.id] = 'text'
      }
    }
    for (const prop of propertySegments) {
      allEntries[prop.id] = prop.text
      if (prop.property === 'reading' && prop.node?.type === 'ruby') {
        allEntryMeta[prop.id] = 'ruby.reading'
      } else {
        allEntryMeta[prop.id] = `property.${prop.property}`
      }
    }

    const metaEntries: Record<string, string> = { __title__: content.title }
    const metaEntryMeta: Record<string, string> = { __title__: 'meta.title' }
    if (content.summary) metaEntries.__summary__ = content.summary
    if (content.summary) metaEntryMeta.__summary__ = 'meta.summary'
    if (content.tags?.length) {
      metaEntries.__tags__ = content.tags.join('|||')
      metaEntryMeta.__tags__ = 'meta.tags'
    }

    if (Object.keys(allEntries).length === 0) {
      const result = await this.callChunkTranslation(
        targetLang,
        {
          documentContext: content.title,
          textEntries: metaEntries,
          segmentMeta: metaEntryMeta,
        },
        runtime,
        onToken,
        signal,
      )
      sourceLang = result.sourceLang
      for (const [id, text] of Object.entries(result.translations)) {
        allTranslations.set(id, text)
      }
    } else {
      const documentContext = extractDocumentContext(
        editorState.root?.children ?? [],
      )
      sourceLang = await this.translateChunkedEntries(
        targetLang,
        {
          documentContext,
          entries: allEntries,
          entryMeta: allEntryMeta,
          metaEntries,
          metaEntryMeta,
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
    let sourceLang = existing.sourceLang || ''

    let oldTranslatedState: any
    try {
      oldTranslatedState = JSON.parse(existing.content!)
    } catch {
      throw new Error('Failed to parse existing translated content')
    }

    const oldTranslatedRootChildren: any[] =
      oldTranslatedState?.root?.children ?? []
    const oldBlockNodeMap = new Map<string, any>()
    for (const child of oldTranslatedRootChildren) {
      const state = child?.[NODE_STATE_KEY]
      const blockId =
        state &&
        typeof state === 'object' &&
        typeof state[BLOCK_ID_STATE_KEY] === 'string'
          ? state[BLOCK_ID_STATE_KEY].trim()
          : null
      if (blockId) {
        oldBlockNodeMap.set(blockId, child)
      }
    }

    const currentRootChildren = editorState.root?.children ?? []
    for (let i = 0; i < currentRootChildren.length; i++) {
      const child = currentRootChildren[i]
      const state = child?.[NODE_STATE_KEY]
      const blockId =
        state &&
        typeof state === 'object' &&
        typeof state[BLOCK_ID_STATE_KEY] === 'string'
          ? state[BLOCK_ID_STATE_KEY].trim()
          : null

      if (
        blockId &&
        unchangedBlockIds.has(blockId) &&
        oldBlockNodeMap.has(blockId)
      ) {
        currentRootChildren[i] = oldBlockNodeMap.get(blockId)
      }
    }

    const documentContext = extractDocumentContext(
      editorState.root?.children ?? [],
    )

    const allEntries: Record<string, string> = {}
    const allEntryMeta: Record<string, string> = {}
    for (const seg of segments) {
      if (!seg.translatable) continue
      if (seg.blockId && unchangedBlockIds.has(seg.blockId)) continue
      allEntries[seg.id] = seg.text
      allEntryMeta[seg.id] = 'text'
    }
    for (const prop of propertySegments) {
      if (prop.blockId && unchangedBlockIds.has(prop.blockId)) continue
      allEntries[prop.id] = prop.text
      if (prop.property === 'reading' && prop.node?.type === 'ruby') {
        allEntryMeta[prop.id] = 'ruby.reading'
      } else {
        allEntryMeta[prop.id] = `property.${prop.property}`
      }
    }

    const metaEntries: Record<string, string> = {}
    const metaEntryMeta: Record<string, string> = {}
    const oldMetaHashes = existing.sourceMetaHashes

    const currentTitleHash = md5(content.title)
    if (!oldMetaHashes || oldMetaHashes.title !== currentTitleHash) {
      metaEntries.__title__ = content.title
      metaEntryMeta.__title__ = 'meta.title'
    } else {
      allTranslations.set('__title__', existing.title)
    }

    if (content.summary) {
      const currentSummaryHash = md5(content.summary)
      if (!oldMetaHashes || oldMetaHashes.summary !== currentSummaryHash) {
        metaEntries.__summary__ = content.summary
        metaEntryMeta.__summary__ = 'meta.summary'
      } else if (existing.summary) {
        allTranslations.set('__summary__', existing.summary)
      }
    }

    if (content.tags?.length) {
      const currentTagsHash = md5(content.tags.join('|||'))
      if (!oldMetaHashes || oldMetaHashes.tags !== currentTagsHash) {
        metaEntries.__tags__ = content.tags.join('|||')
        metaEntryMeta.__tags__ = 'meta.tags'
      } else if (existing.tags?.length) {
        allTranslations.set('__tags__', existing.tags.join('|||'))
      }
    }

    const totalEntries =
      Object.keys(allEntries).length + Object.keys(metaEntries).length

    this.logger.log(
      `Incremental entries: content=${Object.keys(allEntries).length} meta=${Object.keys(metaEntries).length} total=${totalEntries}`,
    )

    if (totalEntries === 0) {
      const translatedContent = JSON.stringify(editorState)
      return {
        sourceLang,
        title: allTranslations.get('__title__') ?? existing.title,
        text: this.lexicalService.lexicalToMarkdown(translatedContent),
        contentFormat: ContentFormat.Lexical,
        content: translatedContent,
        summary: allTranslations.get('__summary__') ?? existing.summary ?? null,
        tags: existing.tags ?? null,
        aiModel: info.model,
        aiProvider: info.provider,
      }
    }

    if (Object.keys(allEntries).length === 0) {
      const result = await this.callChunkTranslation(
        targetLang,
        {
          documentContext: content.title,
          textEntries: metaEntries,
          segmentMeta: metaEntryMeta,
        },
        runtime,
        onToken,
        signal,
      )
      if (result.sourceLang) sourceLang = result.sourceLang
      for (const [id, text] of Object.entries(result.translations)) {
        allTranslations.set(id, text)
      }
    } else {
      const sl = await this.translateChunkedEntries(
        targetLang,
        {
          documentContext,
          entries: allEntries,
          entryMeta: allEntryMeta,
          metaEntries,
          metaEntryMeta,
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
    const summary =
      allTranslations.get('__summary__') ?? existing.summary ?? null
    const tagsStr = allTranslations.get('__tags__')
    const tags = tagsStr
      ? tagsStr.split('|||')
      : (existing.tags ?? content.tags ?? null)

    return {
      sourceLang,
      title,
      text: this.lexicalService.lexicalToMarkdown(translatedContent),
      contentFormat: ContentFormat.Lexical,
      content: translatedContent,
      summary,
      tags,
      aiModel: info.model,
      aiProvider: info.provider,
    }
  }

  private async translateChunkedEntries(
    targetLang: string,
    ctx: {
      documentContext: string
      entries: Record<string, string>
      entryMeta: Record<string, string>
      metaEntries: Record<string, string>
      metaEntryMeta: Record<string, string>
    },
    output: Map<string, string>,
    runtime: IModelRuntime,
    onToken?: (count?: number) => Promise<void>,
    signal?: AbortSignal,
  ): Promise<string> {
    const {
      documentContext,
      entries: allEntries,
      entryMeta: allEntryMeta,
      metaEntries,
      metaEntryMeta,
    } = ctx
    const allTranslations = output
    let sourceLang = ''
    const MAX_BATCH_TOKENS = 4000
    const estimateTokens = (text: string) => Math.ceil(text.length / 3)

    const batches: Array<{
      textEntries: Record<string, string>
      segmentMeta: Record<string, string>
    }> = []
    let currentBatch: Record<string, string> = { ...metaEntries }
    let currentBatchMeta: Record<string, string> = { ...metaEntryMeta }
    let currentTokens = Object.values(metaEntries).reduce(
      (s, t) => s + estimateTokens(t),
      0,
    )
    let hasContentEntry = false

    for (const [id, text] of Object.entries(allEntries)) {
      const tokens = estimateTokens(text)
      if (hasContentEntry && currentTokens + tokens > MAX_BATCH_TOKENS) {
        batches.push({
          textEntries: currentBatch,
          segmentMeta: currentBatchMeta,
        })
        currentBatch = {}
        currentBatchMeta = {}
        currentTokens = 0
      }
      currentBatch[id] = text
      currentBatchMeta[id] = allEntryMeta[id] ?? 'text'
      currentTokens += tokens
      hasContentEntry = true
    }
    if (Object.keys(currentBatch).length > 0) {
      batches.push({
        textEntries: currentBatch,
        segmentMeta: currentBatchMeta,
      })
    }

    for (const batch of batches) {
      if (signal?.aborted) {
        throw Object.assign(new Error('Task aborted'), { name: 'AbortError' })
      }
      const result = await this.callChunkTranslation(
        targetLang,
        {
          documentContext,
          textEntries: batch.textEntries,
          segmentMeta: batch.segmentMeta,
        },
        runtime,
        onToken,
        signal,
      )
      if (!sourceLang) sourceLang = result.sourceLang
      for (const [id, text] of Object.entries(result.translations)) {
        allTranslations.set(id, text)
      }

      const missingIds = Object.keys(batch.textEntries).filter(
        (id) => !(id in result.translations),
      )
      if (missingIds.length > 0) {
        const retryEntries: Record<string, string> = {}
        const retryMeta: Record<string, string> = {}
        for (const id of missingIds) {
          retryEntries[id] = batch.textEntries[id]
          if (batch.segmentMeta[id]) {
            retryMeta[id] = batch.segmentMeta[id]
          }
        }
        try {
          const retryResult = await this.callChunkTranslation(
            targetLang,
            {
              documentContext,
              textEntries: retryEntries,
              segmentMeta: retryMeta,
            },
            runtime,
            onToken,
            signal,
          )
          for (const [id, text] of Object.entries(retryResult.translations)) {
            allTranslations.set(id, text)
          }
          const stillMissing = missingIds.filter(
            (id) => !(id in retryResult.translations),
          )
          for (const id of stillMissing) {
            this.logger.warn(
              `Translation missing for segment ${id} after retry, falling back to original`,
            )
          }
        } catch {
          for (const id of missingIds) {
            this.logger.warn(
              `Translation retry failed for segment ${id}, falling back to original`,
            )
          }
        }
      }
    }

    return sourceLang
  }
}
