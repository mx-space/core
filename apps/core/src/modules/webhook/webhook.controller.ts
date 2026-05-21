import { Body, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common'

import { ApiController } from '~/common/decorators/api-controller.decorator'
import { Auth } from '~/common/decorators/auth.decorator'
import { HTTPDecorators } from '~/common/decorators/http.decorator'
import { withMeta } from '~/common/response/envelope.types'
import { MetaObjectBuilder } from '~/common/response/meta-builder'
import { BusinessEvents } from '~/constants/business-event.constant'
import { EntityIdDto } from '~/shared/dto/id.dto'
import { PagerDto } from '~/shared/dto/pager.dto'

import { WebhookDto, WebhookDtoPartial } from './webhook.schema'
import { WebhookService } from './webhook.service'
import { WebhookModel } from './webhook.types'

@ApiController('/webhooks')
@Auth()
export class WebhookController {
  constructor(private readonly service: WebhookService) {}

  @Post('/')
  create(@Body() body: WebhookDto) {
    body.events = this.service.transformEvents(body.events)

    return this.service.createWebhook(body as unknown as WebhookModel)
  }

  @Get('/')
  async getAll() {
    return await this.service.getAllWebhooks()
  }

  @Get('/events')
  getEventsEnum() {
    return Object.values(BusinessEvents)
  }

  @Patch('/:id')
  update(@Body() body: WebhookDtoPartial, @Param() { id }: EntityIdDto) {
    if (body.events) body.events = this.service.transformEvents(body.events)

    return this.service.updateWebhook(id, body)
  }

  @Delete('/:id')
  delete(@Param() { id }: EntityIdDto) {
    return this.service.deleteWebhook(id)
  }

  @Get('/:id')
  async getEventsByHookId(
    @Param() { id }: EntityIdDto,
    @Query() query: PagerDto,
  ) {
    const result = await this.service.getEventsByHookId(id, query)
    const p = result.pagination
    return withMeta(
      result.data,
      new MetaObjectBuilder()
        .pagination({
          page: p.currentPage,
          size: p.size,
          total: p.total,
          total_pages: p.totalPage,
        })
        .build(),
    )
  }

  @Post('/redispatch/:id')
  @HTTPDecorators.Idempotence()
  redispatch(@Param() { id }: EntityIdDto) {
    return this.service.redispatch(id)
  }

  @Delete('/clear/:id')
  clear(@Param() { id }: EntityIdDto) {
    return this.service.clearDispatchEvents(id)
  }
}
