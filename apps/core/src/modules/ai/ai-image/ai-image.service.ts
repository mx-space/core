import { Injectable, Logger, type OnModuleInit } from '@nestjs/common'
import { extension } from 'mime-types'

import { AppErrorCode, createAppException } from '~/common/errors'
import { DatabaseService } from '~/processors/database/database.service'
import {
  type TaskExecuteContext,
  TaskQueueProcessor,
} from '~/processors/task-queue'
import { throwIfAborted } from '~/utils/abort.util'

import { ConfigsService } from '../../configs/configs.service'
import { DraftRepository } from '../../draft/draft.repository'
import { FileService } from '../../file/file.service'
import { AI_PROMPTS } from '../ai.prompts'
import { AiService } from '../ai.service'
import {
  AITaskType,
  type ImageGenerationTaskPayload,
} from '../ai-task/ai-task.types'
import { resolveCoverPreset, resolveCoverSubject } from './cover-preset.util'
import { ImageRuntimeAdapter } from './image-runtime.adapter'
import type {
  IImageRuntime,
  ImageGenerateOptions,
} from './image-runtime.interface'

@Injectable()
export class AiImageService implements OnModuleInit {
  private readonly logger = new Logger(AiImageService.name)

  constructor(
    private readonly configService: ConfigsService,
    private readonly fileService: FileService,
    private readonly taskProcessor: TaskQueueProcessor,
    private readonly aiService: AiService,
    private readonly databaseService: DatabaseService,
    private readonly draftRepository: DraftRepository,
  ) {}

  onModuleInit() {
    this.registerTaskHandler()
  }

  private registerTaskHandler() {
    this.taskProcessor.registerHandler({
      type: AITaskType.ImageGeneration,
      execute: async (
        payload: ImageGenerationTaskPayload,
        context: TaskExecuteContext,
      ) => {
        throwIfAborted(context.signal)

        const config = await this.configService.get('imageGenerationOptions')

        if (!config.enable) {
          throw createAppException(AppErrorCode.IMAGE_GENERATION_DISABLED)
        }

        const { apiKey } = config
        const model = payload.model ?? config.model
        if (!apiKey || !model) {
          throw createAppException(AppErrorCode.IMAGE_PROVIDER_NOT_CONFIGURED)
        }

        const prompt =
          payload.prompt ?? (await this.compileCoverPrompt(payload, context))

        const runtime: IImageRuntime = new ImageRuntimeAdapter({
          provider: config.provider,
          apiKey,
          endpoint: config.endpoint,
          model,
        })

        await context.appendLog(
          'info',
          `Generating image for request ${payload.requestId}`,
        )

        const { images } = await runtime.generateImage({
          prompt,
          aspectRatio: (payload.aspectRatio ??
            config.defaultAspectRatio) as ImageGenerateOptions['aspectRatio'],
          quality: (payload.quality ??
            config.defaultQuality) as ImageGenerateOptions['quality'],
          format: (payload.format ??
            config.defaultFormat) as ImageGenerateOptions['format'],
          providerParams: payload.providerParams,
          signal: context.signal,
        })

        const [image] = images
        if (!image) {
          throw createAppException(AppErrorCode.IMAGE_GENERATION_FAILED, {
            message: 'image runtime returned no images',
          })
        }

        const ext = extension(image.mimeType) || 'png'
        const { url } = await this.fileService.uploadBuffer(image.buffer, {
          type: 'image',
          originalFilename: `ai-${payload.purpose}-${payload.requestId}.${ext}`,
          contentType: image.mimeType,
        })

        await context.setResult({
          url,
          mimeType: image.mimeType,
          prompt,
        })
      },
    })

    this.logger.log('AI image generation task handler registered')
  }

  private async compileCoverPrompt(
    payload: ImageGenerationTaskPayload,
    context: TaskExecuteContext,
  ): Promise<string> {
    if (!payload.presetId) {
      throw createAppException(AppErrorCode.AI_INVALID_PARAMETER, {
        message: 'presetId is required when prompt is omitted',
      })
    }

    const preset = resolveCoverPreset(payload.presetId)
    const article = await resolveCoverSubject(
      {
        databaseService: this.databaseService,
        draftRepository: this.draftRepository,
      },
      payload,
    )

    try {
      const runtime = await this.aiService.getWriterModel()
      const { output } = await runtime.generateStructured({
        ...AI_PROMPTS.cover.compile(preset, article),
        maxRetries: 2,
      })
      return output.prompt
    } catch (error) {
      await context.appendLog(
        'warn',
        `Cover prompt compile failed, using the preset fallback prompt: ${(error as Error).message}`,
      )
      return preset.fallbackPrompt
    }
  }
}
