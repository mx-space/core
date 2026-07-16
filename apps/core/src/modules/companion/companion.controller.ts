import { randomUUID } from 'node:crypto'

import { Get } from '@nestjs/common'

import { ApiController } from '~/common/decorators/api-controller.decorator'
import {
  BYPASS_CASE_TRANSFORM_ROOT,
  BypassCaseTransform,
} from '~/common/decorators/bypass-case-transform.decorator'
import { HttpCache } from '~/common/decorators/cache.decorator'
import { withMeta } from '~/common/response/envelope.types'
import type { ResponseMeta } from '~/common/response/meta.types'

import {
  COMPANION_PRESENCE_SCHEMA,
  COMPANION_PRESENCE_SCHEMA_VERSION,
} from './companion.constants'
import { COMPANION_CAPABILITIES } from './companion.schema'

@ApiController('companion')
export class CompanionController {
  @Get('/capabilities')
  @HttpCache({ disable: true })
  @BypassCaseTransform([BYPASS_CASE_TRANSFORM_ROOT])
  getCapabilities() {
    const meta = {
      schema: COMPANION_PRESENCE_SCHEMA,
      schemaVersion: COMPANION_PRESENCE_SCHEMA_VERSION,
      requestId: randomUUID(),
      serverTime: new Date().toISOString(),
    }

    // Companion owns a protocol-specific response meta contract. The global
    // envelope marker is still required so ResponseInterceptor does not
    // double-wrap it; runtime shape is validated by the Companion schema.
    return withMeta(COMPANION_CAPABILITIES, meta as unknown as ResponseMeta)
  }
}
