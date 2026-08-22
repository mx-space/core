import { Injectable, Logger, type OnModuleInit } from '@nestjs/common'
import { OnEvent } from '@nestjs/event-emitter'
import pLimit from 'p-limit'

import { OperationContext } from '~/common/contexts/operation.context'
import { AppErrorCode, createAppException } from '~/common/errors'
import { BusinessEvents } from '~/constants/business-event.constant'
import { DatabaseService } from '~/processors/database/database.service'
import { LexicalService } from '~/processors/helper/helper.lexical.service'
import { RedisService } from '~/processors/redis/redis.service'
import {
  type TaskExecuteContext,
  TaskQueueProcessor,
  TaskStatus,
} from '~/processors/task-queue'
import { throwIfAborted } from '~/utils/abort.util'

import { ConfigsService } from '../../configs/configs.service'
import { FileService } from '../../file/file.service'
import { MAX_LANGS_PER_TASK } from '../ai.constants'
import { AiGenerationMetricsService } from '../ai-generation-metrics/ai-generation-metrics.service'
import { parseLanguageCode } from '../ai-language.util'
import { AITaskType, type TtsTaskPayload } from '../ai-task/ai-task.types'
import { AiTranslationRepository } from '../ai-translation/ai-translation.repository'
import { readArticleMetaLang } from '../ai-translation/article-content.util'
import { AiTtsRepository } from './ai-tts.repository'
import type {
  ExistingBlockRow,
  PlannedChunk,
  TtsLanguageResult,
  TtsProviderConfig,
  TtsSourceDocument,
  TtsStoredObject,
  TtsVoiceConfig,
} from './ai-tts.types'
import { planChunks, planTts } from './tts-block-plan'
import { withTtsLangLock } from './tts-lang-lock'
import {
  buildTtsObjectKey,
  computeTtsObjectFingerprint,
  resolveTtsObjectKeyPrefix,
} from './tts-object-key'
import {
  resolveTtsLanguageControl,
  TtsRuntimeAdapter,
} from './tts-runtime.adapter'
import { resolveTtsSourceContent } from './tts-source-content'

// Caps in-flight synthesis across every TTS task in this process; ten tasks at
// concurrency 3 would otherwise open sixty provider connections at once.
const GLOBAL_SPEECH_LIMIT = pLimit(8)

const DEFAULT_AUDIO_FORMAT = 'mp3'

interface LanguageRunInput {
  concurrency: number
  configuredVoice: TtsVoiceConfig
  context: TaskExecuteContext
  document: TtsSourceDocument
  force: boolean
  lang: string
  maxCharsPerChunk: number
  maxCharsPerRun: number
  objectKeyPrefix?: string
  provider: TtsProviderConfig
  refId: string
  reportProgress: (done: number, total: number) => Promise<void>
  sourceLang: string
}

function chunkKey(blockId: string, chunkIndex: number): string {
  return `${blockId}#${chunkIndex}`
}

function sameInstant(a?: Date | null, b?: Date | null): boolean {
  return (a?.getTime() ?? null) === (b?.getTime() ?? null)
}

@Injectable()
export class AiTtsService implements OnModuleInit {
  private readonly logger = new Logger(AiTtsService.name)

  constructor(
    private readonly configService: ConfigsService,
    private readonly fileService: FileService,
    private readonly taskProcessor: TaskQueueProcessor,
    private readonly repository: AiTtsRepository,
    private readonly databaseService: DatabaseService,
    private readonly lexicalService: LexicalService,
    private readonly translationRepository: AiTranslationRepository,
    private readonly redisService: RedisService,
    private readonly generationMetrics: AiGenerationMetricsService,
  ) {}

  onModuleInit() {
    this.taskProcessor.registerHandler({
      type: AITaskType.Tts,
      execute: async (payload: TtsTaskPayload, context: TaskExecuteContext) => {
        await this.runTask(payload, context)
      },
    })

    this.logger.log('AI TTS task handler registered')
  }

  private async runTask(payload: TtsTaskPayload, context: TaskExecuteContext) {
    throwIfAborted(context.signal)

    const aiConfig = await this.configService.get('ai')
    const config = aiConfig.tts
    if (!config?.enable) {
      throw createAppException(AppErrorCode.TTS_DISABLED)
    }
    const resolved = await this.configService.resolveAiProviderForCapability(
      'speech',
      config.model,
    )
    const { voice } = config
    if (!resolved?.provider.apiKey || !resolved.model || !voice) {
      throw createAppException(AppErrorCode.TTS_PROVIDER_NOT_CONFIGURED)
    }
    const { model, provider } = resolved

    const document = await this.loadDocument(payload.refId)
    const sourceLang = parseLanguageCode(readArticleMetaLang(document))
    const targets = payload.langs?.length
      ? [...new Set(payload.langs.map((lang) => parseLanguageCode(lang)))]
      : [sourceLang]

    if (targets.length > MAX_LANGS_PER_TASK) {
      throw createAppException(AppErrorCode.AI_INVALID_PARAMETER, {
        message: `a tts task carries at most ${MAX_LANGS_PER_TASK} languages`,
      })
    }

    const { prefix } = await this.configService.get('imageStorageOptions')
    const objectKeyPrefix = resolveTtsObjectKeyPrefix(prefix)

    const perLang: TtsLanguageResult[] = []
    const skipped: Array<{ lang: string; reason: string }> = []
    const failed: Array<{ lang: string; reason: string }> = []

    await context.updateProgress(0, 'Starting narration', 0, targets.length)

    const redis = this.redisService.getClient()
    const shared = {
      concurrency: config.concurrency,
      configuredVoice: { model, voice, speed: config.speed },
      context,
      document,
      force: Boolean(payload.force),
      maxCharsPerChunk: config.maxCharsPerChunk,
      maxCharsPerRun: config.maxCharsPerRun,
      objectKeyPrefix,
      provider: {
        provider: provider.id,
        apiKey: provider.apiKey,
        endpoint: provider.endpoint || undefined,
        projectId: provider.projectId,
        providerType: provider.type,
      },
      refId: payload.refId,
      sourceLang,
    }

    for (const [index, lang] of targets.entries()) {
      throwIfAborted(context.signal)

      try {
        const result = await withTtsLangLock(
          redis,
          payload.refId,
          lang,
          () =>
            this.runLanguage({
              ...shared,
              lang,
              reportProgress: (done, total) =>
                context.updateProgress(
                  Math.round(((index + done / total) / targets.length) * 100),
                  `Generated ${done}/${total} (${lang})`,
                  done,
                  total,
                ),
            }),
          (error, phase) =>
            this.logger.warn(
              `tts lock ${phase} failed for ${payload.refId}:${lang}: ${error.message}`,
            ),
        )

        if (!result) {
          skipped.push({ lang, reason: 'another run holds the lock' })
          await context.appendLog(
            'warn',
            `narration for ${lang} skipped: another run holds the lock`,
          )
          continue
        }
        perLang.push(result)
      } catch (error) {
        if ((error as Error).name === 'AbortError') throw error
        const reason = (error as Error).message
        failed.push({ lang, reason })
        await context.appendLog(
          'error',
          `narration for ${lang} failed: ${reason}`,
        )
      }
    }

    await context.updateProgress(
      100,
      `Narrated ${perLang.length}/${targets.length}`,
      targets.length,
      targets.length,
    )
    await context.setResult({ perLang, skipped, failed })

    // A requeued language committed chunks but never published its block_order,
    // so reporting it green would hide unfinished work from the operator.
    const requeued = perLang.filter((result) => result.requeued).length
    const attempted = targets.length - skipped.length
    if (failed.length > 0 && failed.length === attempted) {
      context.setStatus(TaskStatus.Failed)
    } else if (failed.length > 0 || requeued > 0) {
      context.setStatus(TaskStatus.PartialFailed)
    }
  }

  private async runLanguage(
    input: LanguageRunInput,
  ): Promise<TtsLanguageResult> {
    const { context, document, force, lang, refId, sourceLang } = input

    const isTranslation = lang !== sourceLang
    const { content, sourceModifiedAt } = await resolveTtsSourceContent({
      document,
      findTranslation: (id, code) =>
        this.translationRepository.findByRefAndLang(id, code),
      isTranslation,
      lang,
      refId,
      sourceLang,
    })

    const { chunks, blocksWithoutId } = planChunks(
      this.lexicalService.extractRootBlockNodes(content),
      input.maxCharsPerChunk,
    )
    if (blocksWithoutId.length > 0) {
      this.logger.warn(
        `speakable blocks without an id at index ${blocksWithoutId.join(', ')}: ref=${refId} lang=${lang}`,
      )
    }

    const parent = await this.repository.findByRefAndLang(refId, lang)
    const existing = parent ? await this.repository.findBlocks(parent.id) : []
    if (!chunks.length && !parent) {
      throw createAppException(AppErrorCode.TTS_SOURCE_NOT_LEXICAL, { lang })
    }

    const voice: TtsVoiceConfig =
      parent && !force
        ? { model: parent.model, voice: parent.voice, speed: parent.speed }
        : input.configuredVoice
    const languageControl = resolveTtsLanguageControl(
      { ...input.provider, model: voice.model },
      lang,
    )
    const audioFormat = languageControl.audioFormat ?? DEFAULT_AUDIO_FORMAT
    const objectKeyFor = (chunk: PlannedChunk) =>
      buildTtsObjectKey({
        prefix: input.objectKeyPrefix,
        refId,
        lang,
        blockId: chunk.blockId,
        chunkIndex: chunk.chunkIndex,
        format: audioFormat,
        fingerprint: computeTtsObjectFingerprint(
          chunk.fingerprint,
          voice,
          languageControl.cacheKey,
        ),
      })

    const plan = planTts({ chunks, existing, force, objectKeyFor })
    const spendChars = plan.toGenerate.reduce(
      (sum, chunk) => sum + chunk.text.length,
      0,
    )
    if (spendChars > input.maxCharsPerRun) {
      throw createAppException(AppErrorCode.TTS_BUDGET_EXCEEDED, {
        charCount: spendChars,
        limit: input.maxCharsPerRun,
      })
    }

    const parentBase = {
      ...voice,
      refId,
      lang,
      isTranslation,
      sourceLang: isTranslation ? sourceLang : null,
      format: audioFormat,
    }

    // ai_tts_blocks carries an FK to ai_tts, so a first run needs the parent row
    // before any chunk can commit; block_order stays empty until finalize so an
    // unfinished language is simply not published yet.
    const ttsId =
      parent?.id ??
      (
        await this.repository.upsertParent({
          ...parentBase,
          blockOrder: [],
          charCount: 0,
          sourceModifiedAt: null,
        })
      ).id

    const { displaced, generated } = await this.synthesize(input, {
      existing,
      objectKeyFor,
      toGenerate: plan.toGenerate,
      ttsId,
      voice,
    })

    const summary = {
      lang,
      ttsId,
      total: chunks.length,
      generated,
      reused: plan.toReuse.length,
      deleted: 0,
      charCount: plan.charCount,
    }

    const current = await this.loadDocument(refId)
    if (!sameInstant(current.modifiedAt, document.modifiedAt)) {
      this.logger.warn(
        `tts source changed mid-run, finalize skipped: ref=${refId} lang=${lang}`,
      )
      await context.appendLog(
        'warn',
        `source changed mid-run; ${lang} narration is not published yet`,
      )
      return { ...summary, requeued: true }
    }

    await this.repository.upsertParent({
      ...parentBase,
      blockOrder: plan.blockOrder,
      charCount: plan.charCount,
      sourceModifiedAt,
    })
    await this.repository.deleteBlocksByIds(
      plan.toDelete.map((row) => row.rowId),
    )
    await this.deleteObjects([...plan.toDelete, ...displaced])

    if (generated > 0) {
      await this.generationMetrics.record({
        resourceType: 'tts',
        resourceId: ttsId,
        refId,
        lang,
        taskId: context.taskId,
        providerId: input.provider.provider,
        model: voice.model,
        usage: null,
      })
    }

    return { ...summary, deleted: plan.toDelete.length }
  }

  private async synthesize(
    input: LanguageRunInput,
    work: {
      existing: ExistingBlockRow[]
      objectKeyFor: (chunk: PlannedChunk) => string
      toGenerate: PlannedChunk[]
      ttsId: string
      voice: TtsVoiceConfig
    },
  ): Promise<{ displaced: TtsStoredObject[]; generated: number }> {
    const { context } = input
    const { existing, objectKeyFor, toGenerate, ttsId, voice } = work

    const previousByKey = new Map(
      existing.map((row) => [chunkKey(row.blockId, row.chunkIndex), row]),
    )
    const runtime = new TtsRuntimeAdapter({
      ...input.provider,
      model: voice.model,
      sessionId: OperationContext.currentId(),
    })
    const limit = pLimit(input.concurrency)
    const displaced: TtsStoredObject[] = []
    const total = toGenerate.length
    let done = 0

    // p-limit cancels nothing on the first rejection, so every limited task has
    // to settle before the caller releases the language lock — otherwise a
    // straggler keeps writing rows after another holder has acquired it.
    const settled = await Promise.allSettled(
      toGenerate.map((chunk) =>
        limit(async () => {
          throwIfAborted(context.signal)

          const { buffer, mimeType } = await GLOBAL_SPEECH_LIMIT(() =>
            runtime.generateSpeech({
              input: chunk.text,
              language: input.lang,
              voice: voice.voice,
              speed: voice.speed,
              signal: context.signal,
            }),
          )

          const uploaded = await this.uploadChunk(
            buffer,
            objectKeyFor(chunk),
            mimeType,
          )

          // planTts leaves a regenerated chunk out of toDelete because the upsert
          // replaces its row, so its old object is only reachable from here.
          const previous = previousByKey.get(
            chunkKey(chunk.blockId, chunk.chunkIndex),
          )
          if (previous && previous.storageKey !== uploaded.storageKey) {
            displaced.push({
              storageBackend: previous.storageBackend,
              storageKey: previous.storageKey,
            })
          }

          await this.repository.upsertBlock({
            ttsId,
            blockId: chunk.blockId,
            chunkIndex: chunk.chunkIndex,
            fingerprint: chunk.fingerprint,
            text: chunk.text,
            url: uploaded.url,
            storageBackend: uploaded.storageBackend,
            storageKey: uploaded.storageKey,
            byteSize: buffer.length,
          })

          done += 1
          await input.reportProgress(done, total)
        }),
      ),
    )

    const rejections = settled
      .filter((result) => result.status === 'rejected')
      .map((result) => result.reason as Error)
    const aborted = rejections.find((error) => error?.name === 'AbortError')
    if (aborted) throw aborted
    if (rejections.length > 0) throw rejections[0]

    return { displaced, generated: done }
  }

  private async uploadChunk(
    buffer: Buffer,
    objectKey: string,
    contentType: string,
  ) {
    try {
      return await this.fileService.uploadBuffer(buffer, {
        type: 'audio',
        contentType,
        objectKey,
      })
    } catch (error) {
      // Object keys are content-addressed, so a resumed run rewrites byte-identical
      // audio; the local backend rejects that as FILE_EXISTS instead of overwriting.
      if ((error as { code?: string })?.code !== AppErrorCode.FILE_EXISTS) {
        throw error
      }
      return {
        url: await this.fileService.resolveFileUrl('audio', objectKey),
        name: objectKey.split('/').pop()!,
        storageBackend: 'local' as const,
        storageKey: objectKey,
      }
    }
  }

  private async loadDocument(refId: string): Promise<TtsSourceDocument> {
    const article = await this.databaseService.findGlobalById(refId)
    if (!article?.document) {
      throw createAppException(AppErrorCode.CONTENT_NOT_FOUND_CANT_PROCESS)
    }
    return article.document as TtsSourceDocument
  }

  private async deleteObjects(objects: TtsStoredObject[]): Promise<void> {
    for (const object of objects) {
      try {
        await this.fileService.deleteObject(
          object.storageBackend,
          object.storageKey,
        )
      } catch (error) {
        this.logger.warn(
          `failed to delete tts object ${object.storageKey}: ${(error as Error).message}`,
        )
      }
    }
  }

  @OnEvent(BusinessEvents.POST_DELETE)
  @OnEvent(BusinessEvents.NOTE_DELETE)
  @OnEvent(BusinessEvents.PAGE_DELETE)
  async handleDeleteArticle(event: { id: string }): Promise<void> {
    await this.handleArticleDeleted(event.id)
  }

  async handleArticleDeleted(refId: string): Promise<void> {
    const parents = await this.repository.findAllByRef(refId)
    const removed = await this.repository.deleteByRefId(refId)
    await this.deleteObjects(removed)
    for (const parent of parents) {
      await this.generationMetrics.deleteByResource('tts', String(parent.id))
    }
  }

  async deleteById(id: string): Promise<void> {
    const removed = await this.repository.deleteById(id)
    await this.deleteObjects(removed)
    await this.generationMetrics.deleteByResource('tts', id)
  }
}
