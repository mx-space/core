import { Body, Post, Req, Res } from '@nestjs/common'
import type { FastifyReply, FastifyRequest } from 'fastify'

import { ApiController } from '~/common/decorators/api-controller.decorator'
import { CurrentReaderId } from '~/common/decorators/current-user.decorator'
import { HTTPDecorators } from '~/common/decorators/http.decorator'
import { Lang } from '~/common/decorators/lang.decorator'
import { HasAdminAccess } from '~/common/decorators/role.decorator'
import { applyNdjsonHeaders, subscribeNdjson } from '~/utils/ndjson.util'

import { ArticleBodiesDto } from './article-body.schema'
import { ArticleBodyService } from './article-body.service'

@ApiController('articles')
export class ArticleBodyController {
  constructor(private readonly articleBodyService: ArticleBodyService) {}

  @Post('/bodies')
  @HTTPDecorators.RawResponse
  @HTTPDecorators.SkipLogging
  async streamBodies(
    @Body() body: ArticleBodiesDto,
    @Lang() lang: string | undefined,
    @HasAdminAccess() isOwner: boolean,
    @CurrentReaderId() readerId: string | undefined,
    @Req() request: FastifyRequest,
    @Res() reply: FastifyReply,
  ) {
    applyNdjsonHeaders(reply, request)
    await subscribeNdjson(
      reply,
      this.articleBodyService.streamBodies(body.items, {
        isOwner,
        lang,
        readerId,
      }),
    )
  }
}
