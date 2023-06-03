import { Get, Param } from '@nestjs/common'

import { ApiController } from '~/common/decorators/api-controller.decorator'
import { DatabaseService } from '~/processors/database/database.service'
import { UrlBuilderService } from '~/processors/helper/helper.url-builder.service'
import { MongoIdDto } from '~/shared/dto/id.dto'

import { HelperService } from './helper.service'

@ApiController('helper')
export class HelperController {
  constructor(
    private readonly helperService: HelperService,

    private readonly urlBulderService: UrlBuilderService,
    private readonly databaseService: DatabaseService,
  ) {}

  @Get('/url-builder/:id')
  async builderById(@Param() params: MongoIdDto) {
    const doc = await this.databaseService.findGlobalById(params.id)
    if (!doc) return null

    if (doc.type === 'Recently') return null

    return this.urlBulderService.buildWithBaseUrl(doc.document)
  }
}
