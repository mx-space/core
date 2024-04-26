import { FastifyReply } from 'fastify'

import { BadRequestException, Get, Param, Query, Res } from '@nestjs/common'

import { ApiController } from '~/common/decorators/api-controller.decorator'
import { CollectionRefTypes } from '~/constants/db.constant'
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
  async builderById(
    @Param() params: MongoIdDto,
    @Query('redirect') redirect: boolean,

    @Res() res: FastifyReply,
  ) {
    const doc = await this.databaseService.findGlobalById(params.id)
    if (!doc || doc.type === CollectionRefTypes.Recently) {
      if (redirect) {
        throw new BadRequestException(
          'not found or this type can not redirect to',
        )
      }

      res.send(null)
      return
    }

    const url = await this.urlBulderService.buildWithBaseUrl(doc.document)

    if (redirect) {
      res.status(301).redirect(url)
    } else {
      res.send({ data: url })
    }
  }
}
