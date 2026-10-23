import { Body, Post } from '@nestjs/common'

import { ApiController } from '~/common/decorators/api-controller.decorator'
import { CurrentReaderId } from '~/common/decorators/current-user.decorator'
import { HasAdminAccess } from '~/common/decorators/role.decorator'

import {
  type PushActivationRequestDto,
  PushActivationRequestSchema,
} from './push.schema'
import { PushService } from './push.service'

@ApiController('notifications/push')
export class PushController {
  constructor(private readonly service: PushService) {}

  @Post('/activate')
  activate(
    @Body({ schema: PushActivationRequestSchema })
    body: PushActivationRequestDto,
    @CurrentReaderId() readerId?: string,
    @HasAdminAccess() ownerAuthorized = false,
  ) {
    return this.service.activate(readerId, body, ownerAuthorized)
  }
}
