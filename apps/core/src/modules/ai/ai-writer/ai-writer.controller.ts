import { Body, Post } from '@nestjs/common'

import { ApiController } from '~/common/decorators/api-controller.decorator'
import { Auth } from '~/common/decorators/auth.decorator'

import { AiQueryType, GenerateAiDto } from './ai-writer.dto'
import { AiWriterService } from './ai-writer.service'

@ApiController('ai/writer')
export class AiWriterController {
  constructor(private readonly aiWriterService: AiWriterService) {}

  @Post('generate')
  @Auth()
  async generate(@Body() body: GenerateAiDto) {
    switch (body.type) {
      case AiQueryType.TitleSlug:
        return this.aiWriterService.generateTitleAndSlugByOpenAI(body.text)
      case AiQueryType.Title:
      case AiQueryType.Slug:
        return this.aiWriterService.generateSlugByTitleViaOpenAI(body.title)
    }
  }
}
