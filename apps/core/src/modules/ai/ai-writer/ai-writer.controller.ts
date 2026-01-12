import { Body, Post } from '@nestjs/common'
import { ApiController } from '~/common/decorators/api-controller.decorator'
import { Auth } from '~/common/decorators/auth.decorator'
import { BizException } from '~/common/exceptions/biz.exception'
import { ErrorCodeEnum } from '~/constants/error-code.constant'
import { AiQueryType, GenerateAiDto } from './ai-writer.schema'
import { AiWriterService } from './ai-writer.service'

@ApiController('ai/writer')
export class AiWriterController {
  constructor(private readonly aiWriterService: AiWriterService) {}

  @Post('generate')
  @Auth()
  async generate(@Body() body: GenerateAiDto) {
    switch (body.type) {
      case AiQueryType.TitleSlug:
        return this.aiWriterService.generateTitleAndSlugByOpenAI(body.text!)
      case AiQueryType.Slug:
        return this.aiWriterService.generateSlugByTitleViaOpenAI(body.title!)
      default:
        throw new BizException(ErrorCodeEnum.Default, 'Invalid query type')
    }
  }
}
