import {
  Body,
  Get,
  HttpStatus,
  Post,
  Put,
  UseFilters,
  UseGuards,
} from '@nestjs/common'
import { SkipThrottle } from '@nestjs/throttler'

import { ApiController } from '~/common/decorators/api-controller.decorator'
import {
  BYPASS_CASE_TRANSFORM_ROOT,
  BypassCaseTransform,
} from '~/common/decorators/bypass-case-transform.decorator'
import { HttpCache } from '~/common/decorators/cache.decorator'
import { WithFastifyRouteOptions } from '~/common/decorators/fastify-route-options.decorator'
import { HTTPDecorators } from '~/common/decorators/http.decorator'
import { AppException } from '~/common/errors/exception.types'
import { withMeta } from '~/common/response/envelope.types'

import { COMPANION_PRESENCE_PAYLOAD_BYTES } from './companion.constants'
import { CompanionDeviceErrorCode } from './companion-device.constants'
import {
  CompanionDeviceAuth,
  CurrentCompanionDevice,
} from './companion-device.decorator'
import type { CompanionDevicePrincipal } from './companion-device.guard'
import {
  CompanionPresenceClearRequestV2Dto,
  CompanionPresenceRequestV2Dto,
} from './companion-presence.dto'
import { companionPresenceFastifyErrorHandler } from './companion-presence.fastify'
import { CompanionPresenceExceptionFilter } from './companion-presence.filter'
import { CompanionPresenceStore } from './companion-presence.store'
import {
  CompanionPresenceRateLimiter,
  CompanionPresenceTransportGuard,
} from './companion-presence.transport'
import {
  asResponseMeta,
  createCompanionResponseMeta,
} from './companion-response'

const assertBoundDevice = (
  principal: CompanionDevicePrincipal,
  requestDeviceId: string,
) => {
  if (principal.deviceId !== requestDeviceId) {
    // Use the same unauthorized boundary as an invalid token; callers must not
    // learn whether another public device identifier exists.
    throw new AppException(
      CompanionDeviceErrorCode.deviceRevoked,
      'Companion device token is invalid or revoked.',
      HttpStatus.UNAUTHORIZED,
    )
  }
}

@ApiController('companion')
@BypassCaseTransform([BYPASS_CASE_TRANSFORM_ROOT])
@HTTPDecorators.SkipLogging
@UseFilters(CompanionPresenceExceptionFilter)
export class CompanionPresenceController {
  constructor(
    private readonly store: CompanionPresenceStore,
    private readonly rateLimiter: CompanionPresenceRateLimiter,
  ) {}

  @Put('/presence')
  @SkipThrottle()
  @WithFastifyRouteOptions({
    bodyLimit: COMPANION_PRESENCE_PAYLOAD_BYTES,
    errorHandler: companionPresenceFastifyErrorHandler,
  })
  @UseGuards(CompanionPresenceTransportGuard)
  @CompanionDeviceAuth('companion:presence:write')
  async putPresence(
    @CurrentCompanionDevice() principal: CompanionDevicePrincipal,
    @Body() request: CompanionPresenceRequestV2Dto,
  ) {
    assertBoundDevice(principal, request.meta.deviceId)
    await this.rateLimiter.consume(principal.deviceId)
    const data = await this.store.putSnapshot(request)
    return withMeta(
      data,
      asResponseMeta(createCompanionResponseMeta(request.meta.requestId)),
    )
  }

  @Post('/presence/clear')
  @SkipThrottle()
  @WithFastifyRouteOptions({
    bodyLimit: COMPANION_PRESENCE_PAYLOAD_BYTES,
    errorHandler: companionPresenceFastifyErrorHandler,
  })
  @UseGuards(CompanionPresenceTransportGuard)
  @CompanionDeviceAuth('companion:presence:write')
  async clearPresence(
    @CurrentCompanionDevice() principal: CompanionDevicePrincipal,
    @Body() request: CompanionPresenceClearRequestV2Dto,
  ) {
    assertBoundDevice(principal, request.meta.deviceId)
    await this.rateLimiter.consume(principal.deviceId)
    const data = await this.store.clear(request)
    return withMeta(
      data,
      asResponseMeta(createCompanionResponseMeta(request.meta.requestId)),
    )
  }

  @Get('/presence/public')
  @HttpCache({ disable: true })
  async getPublicPresence() {
    const state = await this.store.getPublicState()
    return withMeta({ state }, asResponseMeta(createCompanionResponseMeta()))
  }
}
