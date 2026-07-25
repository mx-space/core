import { Body, Get, HttpCode, Post } from '@nestjs/common'

import { ApiController } from '~/common/decorators/api-controller.decorator'
import { Auth } from '~/common/decorators/auth.decorator'
import { AppErrorCode, createAppException } from '~/common/errors'
import { CollectionRefTypes } from '~/constants/db.constant'
import { DatabaseService } from '~/processors/database/database.service'

import { ConfigsService } from '../../configs/configs.service'
import type { CoverStylePreset } from '../ai.prompts'
import { AI_PROMPTS, COVER_STYLE_PRESETS } from '../ai.prompts'
import { AiService } from '../ai.service'
import { AiTaskService } from '../ai-task/ai-task.service'
import {
  DraftImagePromptDto,
  type GenerateImageDto,
  type GenerateImageInput,
} from './ai-image.dto'
import type { ImageModelView } from './ai-image.views'
import { AiImageViews } from './ai-image.views'
import { getImageCatalog } from './image-catalog'

const DRAFT_PROMPT_FALLBACK_SUMMARY_MAX_LENGTH = 800

@ApiController('ai/image')
export class AiImageController {
  constructor(
    private readonly aiService: AiService,
    private readonly aiTaskService: AiTaskService,
    private readonly configsService: ConfigsService,
    private readonly databaseService: DatabaseService,
  ) {}

  @Post('draft-prompt')
  @HttpCode(200)
  @Auth()
  async draftPrompt(@Body() body: DraftImagePromptDto) {
    const preset = this.resolveCoverPreset(body.presetId)
    const article = body.refId
      ? await this.resolveArticleForDraftPrompt(body.refId)
      : { title: body.title!, summary: body.summary! }

    const runtime = await this.aiService.getWriterModel()
    const { output } = await runtime.generateStructured({
      ...AI_PROMPTS.cover.compile(preset, article),
      maxRetries: 2,
    })

    return AiImageViews.draftPrompt.parse(output)
  }

  @Post('generate')
  @HttpCode(200)
  @Auth()
  async generate(@Body() body: GenerateImageDto) {
    let aspectRatio = body.aspectRatio
    if (body.presetId) {
      const preset = this.resolveCoverPreset(body.presetId)
      aspectRatio ??=
        preset.defaultAspectRatio as GenerateImageInput['aspectRatio']
    }

    const result = await this.aiTaskService.createImageGenerationTask({
      prompt: body.prompt,
      purpose: body.purpose,
      aspectRatio,
      quality: body.quality,
      format: body.format,
      providerParams: body.providerParams,
      refId: body.refId,
      requestId: body.requestId,
    })

    return AiImageViews.generate.parse(result)
  }

  @Get('presets')
  @Auth()
  getPresets() {
    return Object.values(COVER_STYLE_PRESETS).map((preset) =>
      AiImageViews.preset.parse({
        id: preset.id,
        label: preset.label,
        defaultAspectRatio: preset.defaultAspectRatio,
      }),
    )
  }

  @Get('models')
  @Auth()
  async getModels(): Promise<ImageModelView[]> {
    const config = await this.configsService.get('imageGenerationOptions')
    const models = await getImageCatalog({
      endpoint: config.endpoint,
      apiKey: config.apiKey,
    })
    return models.map((m) =>
      AiImageViews.model.parse({
        id: m.id,
        provider: config.provider,
        supportedParameters: m.supportedParameters,
      }),
    )
  }

  private resolveCoverPreset(presetId: string): CoverStylePreset {
    const preset = COVER_STYLE_PRESETS[presetId]
    if (!preset) {
      throw createAppException(AppErrorCode.AI_INVALID_PARAMETER, {
        message: `Unknown cover preset: ${presetId}`,
      })
    }
    return preset
  }

  private async resolveArticleForDraftPrompt(
    refId: string,
  ): Promise<{ title: string; summary: string }> {
    const article = await this.databaseService.findGlobalById(refId)
    if (!article || article.type === CollectionRefTypes.Recently) {
      throw createAppException(AppErrorCode.CONTENT_NOT_FOUND_CANT_PROCESS)
    }

    const { document } = article
    const summary =
      'summary' in document && document.summary
        ? document.summary
        : (document.text?.slice(0, DRAFT_PROMPT_FALLBACK_SUMMARY_MAX_LENGTH) ??
          '')

    return { title: document.title, summary }
  }
}
