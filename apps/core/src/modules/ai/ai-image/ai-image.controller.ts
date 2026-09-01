import { Body, Get, HttpCode, Post } from '@nestjs/common'

import { ApiController } from '~/common/decorators/api-controller.decorator'
import { Auth } from '~/common/decorators/auth.decorator'
import { DatabaseService } from '~/processors/database/database.service'

import { ConfigsService } from '../../configs/configs.service'
import { DraftRepository } from '../../draft/draft.repository'
import { AI_PROMPTS, COVER_STYLE_PRESETS } from '../ai.prompts'
import { AiService } from '../ai.service'
import { AIProviderType } from '../ai.types'
import { AiTaskService } from '../ai-task/ai-task.service'
import { getVertexMediaModels } from '../vertex/vertex-model-catalog'
import {
  DraftImagePromptDto,
  DraftImagePromptSchema,
  type GenerateImageDto,
  type GenerateImageInput,
  GenerateImageSchema,
} from './ai-image.dto'
import { AiImageViews, ImageModelView } from './ai-image.views'
import { resolveCoverPreset, resolveCoverSubject } from './cover-preset.util'
import { getImageCatalog } from './image-catalog'

@ApiController('ai/image')
export class AiImageController {
  constructor(
    private readonly aiService: AiService,
    private readonly aiTaskService: AiTaskService,
    private readonly configsService: ConfigsService,
    private readonly databaseService: DatabaseService,
    private readonly draftRepository: DraftRepository,
  ) {}

  @Post('draft-prompt')
  @HttpCode(200)
  @Auth()
  async draftPrompt(
    @Body({ schema: DraftImagePromptSchema }) body: DraftImagePromptDto,
  ) {
    const preset = resolveCoverPreset(body.presetId)
    const article = await resolveCoverSubject(
      {
        databaseService: this.databaseService,
        draftRepository: this.draftRepository,
      },
      body,
    )

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
  async generate(
    @Body({ schema: GenerateImageSchema }) body: GenerateImageDto,
  ) {
    let aspectRatio = body.aspectRatio
    if (body.presetId) {
      const preset = resolveCoverPreset(body.presetId)
      aspectRatio ??=
        preset.defaultAspectRatio as GenerateImageInput['aspectRatio']
    }

    const result = await this.aiTaskService.createImageGenerationTask({
      prompt: body.prompt,
      presetId: body.presetId,
      purpose: body.purpose,
      aspectRatio,
      quality: body.quality,
      format: body.format,
      model: body.model,
      providerParams: body.providerParams,
      refId: body.refId,
      draftId: body.draftId,
      title: body.title,
      summary: body.summary,
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
    const aiConfig = await this.configsService.get('ai')
    const resolved = await this.configsService.resolveAiProviderForCapability(
      'image',
      aiConfig.imageGeneration?.model,
    )
    if (!resolved) return []

    const models =
      resolved.provider.type === AIProviderType.GoogleVertex
        ? getVertexMediaModels('image').map((model) => ({
            ...model,
            supportedParameters: {},
          }))
        : await getImageCatalog({
            endpoint: resolved.provider.endpoint,
            apiKey: resolved.provider.apiKey,
          })
    return models.map((m) =>
      AiImageViews.model.parse({
        id: m.id,
        name: m.name,
        provider: resolved.provider.id,
        supportedParameters: m.supportedParameters,
      }),
    )
  }
}
