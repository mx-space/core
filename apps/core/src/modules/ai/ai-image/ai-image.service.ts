import { Injectable, Logger, type OnModuleInit } from '@nestjs/common'
import { extension } from 'mime-types'

import { AppErrorCode, createAppException } from '~/common/errors'
import {
  type TaskExecuteContext,
  TaskQueueProcessor,
} from '~/processors/task-queue'
import { throwIfAborted } from '~/utils/abort.util'

import { ConfigsService } from '../../configs/configs.service'
import { FileService } from '../../file/file.service'
import {
  AITaskType,
  type ImageGenerationTaskPayload,
} from '../ai-task/ai-task.types'
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

        const { apiKey, model } = config
        if (!apiKey || !model) {
          throw createAppException(AppErrorCode.IMAGE_PROVIDER_NOT_CONFIGURED)
        }

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
          prompt: payload.prompt,
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
          prompt: payload.prompt,
        })
      },
    })

    this.logger.log('AI image generation task handler registered')
  }
}
