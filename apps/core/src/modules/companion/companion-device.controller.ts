import { Body, Delete, Get, Param, Post } from '@nestjs/common'

import { ApiController } from '~/common/decorators/api-controller.decorator'
import { Auth } from '~/common/decorators/auth.decorator'
import {
  BYPASS_CASE_TRANSFORM_ROOT,
  BypassCaseTransform,
} from '~/common/decorators/bypass-case-transform.decorator'
import { HttpCache } from '~/common/decorators/cache.decorator'
import { CurrentUser } from '~/common/decorators/current-user.decorator'
import { HTTPDecorators } from '~/common/decorators/http.decorator'
import type { SessionUser } from '~/modules/auth/auth.types'

import {
  ClaimCompanionPairingDto,
  CompanionDeviceIdParamDto,
  CreateCompanionPairingDto,
} from './companion-device.schema'
import { CompanionDeviceService } from './companion-device.service'

@ApiController('companion')
@BypassCaseTransform([BYPASS_CASE_TRANSFORM_ROOT])
@HTTPDecorators.SkipLogging
export class CompanionDeviceController {
  constructor(private readonly deviceService: CompanionDeviceService) {}

  @Post('/pairings')
  @Auth()
  createPairing(
    @CurrentUser() owner: SessionUser,
    @Body() body: CreateCompanionPairingDto,
  ) {
    return this.deviceService.createPairing(owner.id, body.scopes)
  }

  @Post('/pairings/claim')
  claimPairing(@Body() body: ClaimCompanionPairingDto) {
    return this.deviceService.claimPairing(body.pairingCode, body.deviceName)
  }

  @Get('/devices')
  @Auth()
  @HttpCache({ disable: true })
  listDevices(@CurrentUser() owner: SessionUser) {
    return this.deviceService.listDevices(owner.id)
  }

  @Delete('/devices/:id')
  @Auth()
  revokeDevice(
    @CurrentUser() owner: SessionUser,
    @Param() params: CompanionDeviceIdParamDto,
  ) {
    return this.deviceService.revokeDevice(owner.id, params.id)
  }
}
