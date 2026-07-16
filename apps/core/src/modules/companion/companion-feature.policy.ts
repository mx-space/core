import { HttpStatus, Injectable } from '@nestjs/common'

import { AppException } from '~/common/errors/exception.types'

import { COMPANION_LIVE_DESK_ENABLED } from './companion.constants'

export const assertCompanionLiveDeskAvailable = (enabled: boolean) => {
  if (enabled) return

  throw new AppException(
    'COMPANION_FEATURE_UNAVAILABLE',
    'Companion Live Desk is not enabled on this server.',
    HttpStatus.SERVICE_UNAVAILABLE,
  )
}

@Injectable()
export class CompanionFeaturePolicy {
  assertLiveDeskAvailable() {
    assertCompanionLiveDeskAvailable(COMPANION_LIVE_DESK_ENABLED)
  }
}
