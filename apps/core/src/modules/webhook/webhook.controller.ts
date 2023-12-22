import { Body, Delete, Get, Param, Patch, Post } from '@nestjs/common'

import { ApiController } from '~/common/decorators/api-controller.decorator'
import { Auth } from '~/common/decorators/auth.decorator'
import { BusinessEvents } from '~/constants/business-event.constant'
import { MongoIdDto } from '~/shared/dto/id.dto'

import { WebhookDtoPartial, WebhookModel } from './webhook.model'
import { WebhookService } from './webhook.service'

@ApiController('/webhook')
@Auth()
export class WebhookController {
  constructor(private readonly service: WebhookService) {}

  @Post('/')
  create(@Body() body: WebhookModel) {
    return this.service.createWebhook(body)
  }

  @Get('/')
  async getAll() {
    return this.service.getAllWebhooks().then((data) => {
      Reflect.deleteProperty(data, 'secret')
      return data
    })
  }

  @Patch('/:id')
  async update(@Body() body: WebhookDtoPartial, @Param() { id }: MongoIdDto) {
    return this.service.updateWebhook(id, body)
  }

  @Delete('/:id')
  async delete(@Param() { id }: MongoIdDto) {
    return this.service.deleteWebhook(id)
  }

  @Get('/events')
  async getEventsEnum() {
    return Object.values(BusinessEvents)
  }
}
