import { Get, Param, Query } from '@nestjs/common'

import { ApiController } from '~/common/decorators/api-controller.decorator'
import { Auth } from '~/common/decorators/auth.decorator'
import { withMeta } from '~/common/response/envelope.types'
import { MetaObjectBuilder } from '~/common/response/meta-builder'
import { EntityIdDto } from '~/shared/dto/id.dto'

import { GetOverviewGroupedQueryDto } from './ai-overview.schema'
import { AiOverviewService } from './ai-overview.service'

@ApiController('ai/overview')
export class AiOverviewController {
  constructor(private readonly service: AiOverviewService) {}

  @Get('/grouped')
  @Auth()
  async getOverviewGrouped(@Query() query: GetOverviewGroupedQueryDto) {
    const result = await this.service.getOverviewGrouped(query)
    return withMeta(
      result.data,
      new MetaObjectBuilder().pagination(result.pagination).build(),
    )
  }

  @Get('/article/:id')
  @Auth()
  getArticleOverview(@Param() params: EntityIdDto) {
    return this.service.getArticleOverview(params.id)
  }
}
