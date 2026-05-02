import { Body, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common'

import { ApiController } from '~/common/decorators/api-controller.decorator'
import { Auth } from '~/common/decorators/auth.decorator'
import { HTTPDecorators } from '~/common/decorators/http.decorator'
import { BusinessEvents } from '~/constants/business-event.constant'
import { MongoIdDto } from '~/shared/dto/id.dto'
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
    const data = await this.service.getAllWebhooks()
    Reflect.deleteProperty(data, 'secret')
    return data
  }

  @Patch('/:id')
  update(@Body() body: WebhookDtoPartial, @Param() { id }: MongoIdDto) {
    if (body.events) body.events = this.service.transformEvents(body.events)

    return this.service.updateWebhook(id, body)
  }

  @Delete('/:id')
  delete(@Param() { id }: MongoIdDto) {
    return this.service.deleteWebhook(id)
  }

  @Get('/:id')
  @HTTPDecorators.Paginator
  getEventsByHookId(@Param() { id }: MongoIdDto, @Query() query: PagerDto) {
    return this.service.getEventsByHookId(id, query)
  }

  @Get('/events')
  getEventsEnum() {
    return Object.values(BusinessEvents)
  }

  @Post('/redispatch/:id')
  @HTTPDecorators.Idempotence()
  redispatch(@Param() { id }: MongoIdDto) {
    return this.service.redispatch(id)
  }

  @Delete('/clear/:id')
  clear(@Param() { id }: MongoIdDto) {
    return this.service.clearDispatchEvents(id)
  }
}
