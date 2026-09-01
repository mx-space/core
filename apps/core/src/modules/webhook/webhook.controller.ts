import {
  Body,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common'

import { ApiController } from '~/common/decorators/api-controller.decorator'
import { Auth } from '~/common/decorators/auth.decorator'
import { HTTPDecorators } from '~/common/decorators/http.decorator'
import { withMeta } from '~/common/response/envelope.types'
import { MetaObjectBuilder } from '~/common/response/meta-builder'
import { BusinessEvents } from '~/constants/business-event.constant'
import { type EntityIdDto, EntityIdSchema } from '~/shared/dto/id.dto'
import { type BasicPagerDto, BasicPagerSchema } from '~/shared/dto/pager.dto'

import {
  PartialWebhookSchema,
  type WebhookDto,
  type WebhookDtoPartial,
  WebhookSchema,
} from './webhook.schema'
import { WebhookService } from './webhook.service'
import { type WebhookModel } from './webhook.types'

@ApiController('/webhooks')
@Auth()
export class WebhookController {
  constructor(private readonly service: WebhookService) {}

  @Post('/')
  create(@Body({ schema: WebhookSchema }) body: WebhookDto) {
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
  update(
    @Body({ schema: PartialWebhookSchema }) body: WebhookDtoPartial,
    @Param({ schema: EntityIdSchema }) { id }: EntityIdDto,
  ) {
    if (body.events) body.events = this.service.transformEvents(body.events)

    return this.service.updateWebhook(id, body)
  }

  @Delete('/:id')
  delete(@Param({ schema: EntityIdSchema }) { id }: EntityIdDto) {
    return this.service.deleteWebhook(id)
  }

  @Get('/:id')
  async getEventsByHookId(
    @Param({ schema: EntityIdSchema }) { id }: EntityIdDto,
    @Query({ schema: BasicPagerSchema }) query: BasicPagerDto,
  ) {
    const result = await this.service.getEventsByHookId(id, query)
    return withMeta(
      result.data,
      new MetaObjectBuilder().pagination(result.pagination).build(),
    )
  }

  @Post('/redispatch/:id')
  @HttpCode(200)
  @HTTPDecorators.Idempotence()
  redispatch(@Param({ schema: EntityIdSchema }) { id }: EntityIdDto) {
    return this.service.redispatch(id)
  }

  @Delete('/clear/:id')
  clear(@Param({ schema: EntityIdSchema }) { id }: EntityIdDto) {
    return this.service.clearDispatchEvents(id)
  }
}
