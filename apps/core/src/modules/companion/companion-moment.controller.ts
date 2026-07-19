import { Body, Post, UseFilters } from '@nestjs/common'

import { ApiController } from '~/common/decorators/api-controller.decorator'
import {
  BYPASS_CASE_TRANSFORM_ROOT,
  BypassCaseTransform,
} from '~/common/decorators/bypass-case-transform.decorator'
import { WithFastifyRouteOptions } from '~/common/decorators/fastify-route-options.decorator'
import { HTTPDecorators } from '~/common/decorators/http.decorator'
import { withMeta } from '~/common/response/envelope.types'

import { COMPANION_MOMENT_PAYLOAD_BYTES } from './companion.constants'
import {
  CompanionDeviceAuth,
  CurrentCompanionDevice,
} from './companion-device.decorator'
import type { CompanionDevicePrincipal } from './companion-device.guard'
import { CompanionMomentService } from './companion-moment.service'
import { CompanionMomentRequestV1Dto } from './companion-presence.dto'
import { companionPresenceFastifyErrorHandler } from './companion-presence.fastify'
import { CompanionPresenceExceptionFilter } from './companion-presence.filter'
import {
  asResponseMeta,
  createCompanionResponseMeta,
} from './companion-response'

@ApiController('companion')
@BypassCaseTransform([BYPASS_CASE_TRANSFORM_ROOT])
@HTTPDecorators.SkipLogging
@UseFilters(CompanionPresenceExceptionFilter)
export class CompanionMomentController {
  constructor(private readonly momentService: CompanionMomentService) {}

  @Post('/recently')
  @WithFastifyRouteOptions({
    bodyLimit: COMPANION_MOMENT_PAYLOAD_BYTES,
    errorHandler: companionPresenceFastifyErrorHandler,
  })
  @CompanionDeviceAuth('companion:moment:write')
  async publish(
    @CurrentCompanionDevice() principal: CompanionDevicePrincipal,
    @Body() request: CompanionMomentRequestV1Dto,
  ) {
    const data = await this.momentService.publish(principal, request)
    return withMeta(
      data,
      asResponseMeta(createCompanionResponseMeta(request.meta.requestId)),
    )
  }
}
