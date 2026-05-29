import { Body, Get, Post } from '@nestjs/common'

import { ApiController } from '~/common/decorators/api-controller.decorator'
import { Auth } from '~/common/decorators/auth.decorator'

import { BackfillDto } from './ai-embeddings.schema'
import { AiEmbeddingsService } from './ai-embeddings.service'

@ApiController('ai-embeddings')
export class AiEmbeddingsController {
  constructor(private readonly service: AiEmbeddingsService) {}

  @Post('backfill')
  @Auth()
  async backfill(@Body() body: BackfillDto) {
    return this.service.runBackfill({ sourceTypes: body.sourceTypes })
  }

  @Get('stats')
  @Auth()
  async stats() {
    return this.service.getStats()
  }
}
