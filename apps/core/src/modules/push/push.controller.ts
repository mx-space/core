import { Body, Post } from '@nestjs/common'

import { ApiController } from '~/common/decorators/api-controller.decorator'
import { CurrentReaderId } from '~/common/decorators/current-user.decorator'

import { PushActivationRequestDto } from './push.schema'
import { PushService } from './push.service'

@ApiController('notifications/push')
export class PushController {
  constructor(private readonly service: PushService) {}

  @Post('/activate')
  activate(
    @CurrentReaderId() readerId: string | undefined,
    @Body() body: PushActivationRequestDto,
  ) {
    return this.service.activate(readerId, body)
  }
}
