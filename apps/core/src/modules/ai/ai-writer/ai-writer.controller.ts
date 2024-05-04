import { Body, Post } from '@nestjs/common'
import { ApiController } from '~/common/decorators/api-controller.decorator'
import { AiQueryType, GenerateAiDto } from './ai-writer.dto'
import { AiWriterService } from './ai-writer.service'

@ApiController('ai/writer')
export class AiWriterController {
  constructor(private readonly aiWriterService: AiWriterService) {}

  @Post('generate')
  async generate(@Body() body: GenerateAiDto) {
    switch (body.type) {
      case AiQueryType.TitleSlug:
        return this.aiWriterService.generateTitleAndSlugByOpenAI(body.text)
      case AiQueryType.Title:
        return this.aiWriterService.generateSlugByTitleViaOpenAI(body.title)
    }
  }
}
