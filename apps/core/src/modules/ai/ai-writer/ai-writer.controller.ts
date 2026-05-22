import { Body, Get, Post } from '@nestjs/common'

import { ApiController } from '~/common/decorators/api-controller.decorator'
import { Auth } from '~/common/decorators/auth.decorator'
import { AppErrorCode, createAppException } from '~/common/errors'

import { AiSlugBackfillService } from './ai-slug-backfill.service'
import { AiQueryType, GenerateAiDto } from './ai-writer.schema'
import { AiWriterService } from './ai-writer.service'

@ApiController('ai/writer')
export class AiWriterController {
  constructor(
    private readonly aiWriterService: AiWriterService,
    private readonly aiSlugBackfillService: AiSlugBackfillService,
  ) {}

  @Post('generate')
  @Auth()
  async generate(@Body() body: GenerateAiDto) {
    switch (body.type) {
      case AiQueryType.TitleSlug: {
        return this.aiWriterService.generateTitleAndSlugByOpenAI(body.text!)
      }
      case AiQueryType.Slug: {
        return this.aiWriterService.generateSlugByTitleViaOpenAI(body.title!)
      }
      default: {
        throw createAppException(AppErrorCode.AI_INVALID_QUERY_TYPE)
      }
    }
  }

  @Get('backfill-slugs/status')
  @Auth()
  async getBackfillStatus() {
    const [count, notes] = await Promise.all([
      this.aiSlugBackfillService.getNotesWithoutSlugCount(),
      this.aiSlugBackfillService.getNotesWithoutSlug(50),
    ])
    return { count, notes }
  }

  @Post('backfill-slugs')
  @Auth()
  async backfillSlugs() {
    return this.aiSlugBackfillService.createBackfillTask()
  }
}
