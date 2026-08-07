import { Body, Delete, Get, HttpCode, Param, Post } from '@nestjs/common'

import { ApiController } from '~/common/decorators/api-controller.decorator'
import { Auth } from '~/common/decorators/auth.decorator'
import { CurrentUser } from '~/common/decorators/current-user.decorator'
import type { SessionUser } from '~/modules/auth/auth.types'

import { PushActivationRequestDto, PushBindingIdParamDto } from './push.schema'
import { PushService } from './push.service'

@ApiController('notifications/push')
@Auth()
export class PushController {
  constructor(private readonly service: PushService) {}

  @Post('/activate')
  activate(
    @CurrentUser() owner: SessionUser,
    @Body() body: PushActivationRequestDto,
  ) {
    return this.service.activate(owner.id, body)
  }

  @Get('/status')
  status(@CurrentUser() owner: SessionUser) {
    return this.service.status(owner.id)
  }

  @Delete('/:bindingId')
  @HttpCode(204)
  async deactivate(
    @CurrentUser() owner: SessionUser,
    @Param() params: PushBindingIdParamDto,
  ) {
    await this.service.deactivate(owner.id, params.bindingId)
  }
}
