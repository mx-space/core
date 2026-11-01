import { Body, HttpCode, Post } from '@nestjs/common'

import { ApiController } from '~/common/decorators/api-controller.decorator'
import { Auth } from '~/common/decorators/auth.decorator'

import { ContentUsageRepository } from './content-usage.repository'
import type { ContentUsageQueryDto } from './content-usage.schema'
import { ContentUsageQuerySchema } from './content-usage.schema'

@ApiController('files')
export class ContentUsageController {
  constructor(private readonly repository: ContentUsageRepository) {}

  @Post('/references/usage')
  @HttpCode(200)
  @Auth()
  findUsage(
    @Body({ schema: ContentUsageQuerySchema }) body: ContentUsageQueryDto,
  ) {
    return this.repository.findUsage(body.urls)
  }
}
