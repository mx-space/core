import { Body, Delete, Get, HttpCode, Param, Patch, Post } from '@nestjs/common'

import { ApiController } from '~/common/decorators/api-controller.decorator'
import { CurrentUser } from '~/common/decorators/current-user.decorator'
import { PushAuth } from '~/common/decorators/push-auth.decorator'
import type { SessionUser } from '~/modules/auth/auth.types'

import {
  PushActivationRequestDto,
  PushBindingIdParamDto,
  PushPreferencesPatchDto,
} from './push.schema'
import { PushService } from './push.service'

@ApiController('notifications/push')
@PushAuth()
export class PushController {
  constructor(private readonly service: PushService) {}

  @Post('/activate')
  activate(
    @CurrentUser() reader: SessionUser,
    @Body() body: PushActivationRequestDto,
  ) {
    return this.service.activate(reader.id, body)
  }

  @Get('/status')
  status(@CurrentUser() reader: SessionUser) {
    return this.service.status(reader.id)
  }

  @Get('/preferences')
  getPreferences(@CurrentUser() reader: SessionUser) {
    return this.service.getPreferences(reader.id)
  }

  @Patch('/preferences')
  updatePreferences(
    @CurrentUser() reader: SessionUser,
    @Body() body: PushPreferencesPatchDto,
  ) {
    return this.service.updatePreferences(reader.id, body)
  }

  @Delete('/:bindingId')
  @HttpCode(204)
  async deactivate(
    @CurrentUser() reader: SessionUser,
    @Param() params: PushBindingIdParamDto,
  ) {
    await this.service.deactivate(reader.id, params.bindingId)
  }
}
